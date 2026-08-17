import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, signal, computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, TitleCasePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { OrgDeliveryService, DeliveryDetail as DeliveryDetailData } from '../deliveries.service';
import { UserService, NearbyRider } from '../../../../core/user.service';
import { DeliveryWebSocketService, DriverStatusEvent } from '../../../../core/delivery-websocket.service';
import { ToastService } from '../../../../core/toast.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-delivery-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, CurrencyPipe, DecimalPipe, FormsModule],
  templateUrl: './delivery-detail.html',
})
export class DeliveryDetail implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('detailMap') mapEl?: ElementRef;

  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  delivery = signal<DeliveryDetailData | null>(null);
  loading  = signal(true);
  error    = signal('');

  detailEta = signal<{
    mins: number; distKm: number; label: string;
    routeMins?: number; routeDistKm?: number;
  } | null>(null);

  // ── Action states ─────────────────────────────────────────────────────────────
  cancelling         = signal(false);
  publishing         = signal(false);
  showCancelConfirm  = signal(false);
  showPublishConfirm = signal(false);

  // ── Reassign ──────────────────────────────────────────────────────────────────
  showReassignModal = signal(false);
  reassignLoading   = signal(false);
  reassignSaving    = signal(false);
  reassignRiders    = signal<NearbyRider[]>([]);
  reassignOsrmOk    = signal(true);
  selectedRiderId   = signal<string | null>(null);

  // ── Edit ──────────────────────────────────────────────────────────────────────
  editModal  = signal(false);
  editSaving = signal(false);
  editError  = signal('');
  editForm   = {
    status: '', pickupAddress: '', dropoffAddress: '',
    description: '', price: null as number | null,
  };

  // ── Map internals ─────────────────────────────────────────────────────────────
  private map:         L.Map | null = null;
  private pinLayers:   L.Layer[]    = [];   // pickup / dropoff markers
  private routeLayers: L.Layer[]    = [];   // polylines + chevrons
  private riderMarker: L.Marker | null = null;

  // ── Live rider state ──────────────────────────────────────────────────────────
  private riderState: {
    lat: number | null;
    lng: number | null;
    bearing: number | null;
    onlineStatus: 'ONLINE' | 'OFFLINE';
    lastSeenTs: number;
  } = { lat: null, lng: null, bearing: null, onlineStatus: 'ONLINE', lastSeenTs: 0 };
  private riderSeen = false;

  // ── Subscriptions / timers ────────────────────────────────────────────────────
  private boardSub:         Subscription | null = null;
  private locationSub:      Subscription | null = null;
  private driverStatusSub:  Subscription | null = null;
  private routeRedrawTimer: ReturnType<typeof setTimeout> | null = null;
  private drawGeneration   = 0;

  constructor(
    private route:       ActivatedRoute,
    private router:      Router,
    private service:     OrgDeliveryService,
    private userService: UserService,
    private ws:          DeliveryWebSocketService,
    private toast:       ToastService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadDetail(id);

    // Board events — in-place patch for this delivery's data
    this.boardSub = this.ws.boardEvents$.subscribe(evt => {
      const d = this.delivery();
      if (!d) return;
      const data = evt.data as Record<string, unknown>;
      const evtId = String(data['id'] ?? data['deliveryId'] ?? '');
      if (evtId !== d.id) return;

      const newStatus = data['status'] ? String(data['status']) : null;
      const rider = data['driverName'] ? String(data['driverName']) : null;

      // In-place patch
      if (newStatus || rider) {
        this.delivery.update(current => {
          if (!current) return current;
          return {
            ...current,
            status:     newStatus ?? current.status,
            driverName: rider     ?? current.driverName,
            driverId:   data['driverId'] ? String(data['driverId']) : current.driverId,
          };
        });
      }

      // Toasts are fired globally by OrgDashboard shell — not here.

      // Redraw route if status changed
      if (newStatus) {
        const updated = this.delivery();
        if (updated) this.drawDetailRoute(updated);
      }
    });

    // Rider GPS events
    this.locationSub = this.ws.riderLocations$.subscribe(evt => {
      const d = this.delivery();
      if (!d || !d.driverId) return;
      if (evt.riderId !== d.driverId && evt.deliveryId !== d.id) return;

      const firstAppearance = !this.riderSeen;
      this.riderState.lat = evt.lat;
      this.riderState.lng = evt.lng;
      this.riderState.bearing = evt.bearing;
      this.riderState.onlineStatus = 'ONLINE';
      this.riderState.lastSeenTs = Date.now();
      this.riderSeen    = true;

      this.updateRiderMarker();

      if (firstAppearance) {
        // Immediate route redraw on first GPS fix
        if (this.map) this.drawDetailRoute(d);
      } else {
        // Debounce subsequent redraws — rider is moving
        if (this.routeRedrawTimer) clearTimeout(this.routeRedrawTimer);
        this.routeRedrawTimer = setTimeout(() => {
          const delivery = this.delivery();
          if (delivery && this.map) this.drawDetailRoute(delivery);
        }, 30_000);
      }
    });

    // Driver ONLINE / OFFLINE status events
    this.driverStatusSub = this.ws.driverStatus$.subscribe((evt: DriverStatusEvent) => {
      if (!evt.riderId) return;
      const d = this.delivery();
      if (!d || d.driverId !== evt.riderId) return;

      this.riderState.onlineStatus = evt.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
      if (evt.lastSeenTs) this.riderState.lastSeenTs = evt.lastSeenTs;
      // Toasts (rider online/offline) are fired globally by OrgDashboard shell.

      // Update rider marker color
      this.updateRiderMarker();
    });

    // Org dispatch topic is subscribed once by the OrgDashboard shell.
  }

  private loadDetail(id: string) {
    this.service.getDetail(id).subscribe({
      next: r => {
        this.delivery.set(r.data);
        this.loading.set(false);
        // Seed map with last-known rider position (handles offline / page-load case)
        if (r.data.driverId) this.fetchLastKnownLocation(r.data.driverId);
        if (this.map) {
          this.placePins(r.data);
          this.drawDetailRoute(r.data);
        }
      },
      error: e => {
        this.error.set(e?.error?.message ?? 'Failed to load delivery.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Fetches the rider's last known GPS position from the backend on page load.
   * Needed when the rider is already offline — no live WebSocket events will arrive,
   * so the map would otherwise be empty. Silently no-ops if there is no GPS data.
   */
  private async fetchLastKnownLocation(driverId: string): Promise<void> {
    try {
      const res = await fetch(
        `${environment.apiUrl}/location/riders/${driverId}/last-location`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('tih_token') ?? ''}` } },
      );
      // 204 = rider has never sent GPS — nothing to seed
      if (res.status === 204 || !res.ok) return;
      const json = await res.json();
      const loc  = json?.data;
      if (!loc || loc.lat == null || loc.lng == null) return;

      // Only seed if we don't already have a live position (WebSocket arrived first)
      if (this.riderState.lat !== null) return;

      this.riderState.lat          = loc.lat;
      this.riderState.lng          = loc.lng;
      this.riderState.lastSeenTs   = loc.lastSeenTs ?? 0;
      this.riderState.onlineStatus = loc.online ? 'ONLINE' : 'OFFLINE';
      this.riderSeen = true;

      this.updateRiderMarker();

      // Redraw route using the seeded position
      const d = this.delivery();
      if (this.map && d) this.drawDetailRoute(d);
    } catch { /* silent — rider won't show on map, not a fatal error */ }
  }

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 0);
  }

  ngOnDestroy() {
    if (this.routeRedrawTimer) clearTimeout(this.routeRedrawTimer);
    this.boardSub?.unsubscribe();
    this.locationSub?.unsubscribe();
    this.driverStatusSub?.unsubscribe();
    this.pinLayers.forEach(l => l.remove());
    this.routeLayers.forEach(l => l.remove());
    this.riderMarker?.remove();
    if (this.map) { this.map.remove(); this.map = null; }
  }

  // ── Status helpers ────────────────────────────────────────────────────────────

  statusColor(status: string): string {
    const map: Record<string, string> = {
      CREATED:    '#f97316',
      PUBLISHED:  '#f97316',
      ASSIGNED:   '#f59e0b',
      ACCEPTED:   '#3b82f6',
      IN_TRANSIT: '#8b5cf6',
      ARRIVED:    '#10b981',
      DELIVERED:  '#16a34a',
      DECLINED:   '#ef4444',
      CANCELLED:  '#6b7280',
      FAILED:     '#6b7280',
    };
    return map[status] ?? '#6b7280';
  }

  statusMessage(status: string): { text: string; color: string } {
    const msgs: Record<string, { text: string; color: string }> = {
      CREATED:    { text: 'Waiting to be assigned to a rider',  color: '#f97316' },
      PUBLISHED:  { text: 'Finding the best available rider',   color: '#f97316' },
      ASSIGNED:   { text: 'Rider assigned — heading to pickup', color: '#f59e0b' },
      ACCEPTED:   { text: 'Rider is on the way to collect',     color: '#3b82f6' },
      IN_TRANSIT: { text: 'Package in transit to destination',  color: '#8b5cf6' },
      ARRIVED:    { text: 'Rider has arrived at drop-off',      color: '#10b981' },
      DELIVERED:  { text: 'Package delivered successfully',     color: '#16a34a' },
      DECLINED:   { text: 'Rider declined — needs reassignment',color: '#f59e0b' },
      CANCELLED:  { text: 'This delivery was cancelled',        color: '#6b7280' },
      FAILED:     { text: 'Request expired without a rider',    color: '#ef4444' },
    };
    return msgs[status] ?? { text: status, color: '#6b7280' };
  }

  timelineSteps(): { label: string; done: boolean; current: boolean; isError: boolean }[] {
    const status = this.delivery()?.status ?? '';
    const isCancelled = status === 'CANCELLED' || status === 'FAILED';
    const order = ['CREATED', 'ASSIGNED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'];
    const idx   = order.indexOf(status);
    const labels = ['Placed', 'Rider', 'Transit', 'Arrived', 'Done'];
    return labels.map((label, i) => ({
      label,
      done:    !isCancelled && i < (idx === -1 ? 0 : idx),
      current: !isCancelled && i === (idx === -1 ? 0 : idx),
      isError: isCancelled && i === 0,
    }));
  }

  strategyLabel(s: string | null): string {
    if (!s) return '';
    const m: Record<string, string> = {
      DIRECT_ASSIGN: 'Direct',
      INTERNAL_BID:  'Internal Bid',
      PUBLIC_BID:    'Public Bid',
    };
    return m[s] ?? s;
  }

  private readonly _cargoOptions: Record<string, { emoji: string; label: string }> = {
    DOCUMENTS:   { emoji: '📄', label: 'Documents'   },
    ELECTRONICS: { emoji: '📱', label: 'Electronics' },
    HARDWARE:    { emoji: '🔧', label: 'Hardware'    },
    FOOD:        { emoji: '🍱', label: 'Food'        },
    FRAGILE:     { emoji: '🪟', label: 'Fragile'     },
    OTHER:       { emoji: '📦', label: 'Other'       },
  };

  cargoLabel(value: string | null): string {
    return this._cargoOptions[value ?? '']?.label ?? 'Other';
  }

  cargoEmoji(value: string | null): string {
    return this._cargoOptions[value ?? '']?.emoji ?? '📦';
  }

  /** Whether the assigned rider is currently offline but has a known position. */
  get riderOfflineWithLocation(): boolean {
    return this.riderState.onlineStatus === 'OFFLINE'
        && this.riderState.lat !== null
        && !!this.delivery()?.driverId;
  }

  /** Human-readable "X min ago" label for the last-seen timestamp. */
  lastSeenLabel(): string {
    const ts = this.riderState.lastSeenTs;
    if (!ts) return 'unknown';
    const diffMs = Date.now() - ts;
    const mins   = Math.floor(diffMs / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  }

  get isTerminal(): boolean {
    return ['DELIVERED', 'CANCELLED', 'FAILED'].includes(this.delivery()?.status ?? '');
  }

  get canCancel(): boolean {
    return !['DELIVERED', 'CANCELLED', 'FAILED', 'IN_TRANSIT'].includes(this.delivery()?.status ?? '');
  }

  get canPublish(): boolean {
    return ['ASSIGNED', 'DECLINED'].includes(this.delivery()?.status ?? '');
  }

  get canReassign(): boolean {
    return ['ASSIGNED', 'DECLINED'].includes(this.delivery()?.status ?? '');
  }

  // ── Cancel ────────────────────────────────────────────────────────────────────

  confirmCancel() {
    const d = this.delivery();
    if (!d) return;
    this.cancelling.set(true);
    this.showCancelConfirm.set(false);
    this.service.cancel(d.id).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.loadDetail(d.id);
      },
      error: e => {
        this.cancelling.set(false);
        this.toast.error('Error', e?.error?.message ?? 'Failed to cancel delivery.');
      },
    });
  }

  // ── Publish ───────────────────────────────────────────────────────────────────

  confirmPublish() {
    const d = this.delivery();
    if (!d) return;
    this.publishing.set(true);
    this.showPublishConfirm.set(false);
    this.service.publish(d.id).subscribe({
      next: () => {
        this.publishing.set(false);
        this.toast.success('Published', 'Delivery published to open bidding.');
        this.loadDetail(d.id);
      },
      error: e => {
        this.publishing.set(false);
        this.toast.error('Error', e?.error?.message ?? 'Failed to publish delivery.');
      },
    });
  }

  // ── Reassign ──────────────────────────────────────────────────────────────────

  openReassign() {
    const d = this.delivery();
    this.showReassignModal.set(true);
    this.selectedRiderId.set(null);
    this.reassignLoading.set(true);
    this.userService.getNearbyRiders(d?.pickupLat, d?.pickupLng).subscribe({
      next: r => {
        this.reassignRiders.set(r.data.riders ?? []);
        this.reassignOsrmOk.set(r.data.osrmAvailable !== false);
        this.reassignLoading.set(false);
      },
      error: () => {
        this.reassignLoading.set(false);
        this.toast.error('Error', 'Could not load riders.');
      },
    });
  }

  confirmReassign() {
    const d  = this.delivery();
    const id = this.selectedRiderId();
    if (!d || !id) return;
    this.reassignSaving.set(true);
    this.service.reassign(d.id, id).subscribe({
      next: () => {
        this.reassignSaving.set(false);
        this.showReassignModal.set(false);
        this.toast.success('Reassigned', 'Rider has been reassigned successfully.');
        this.loadDetail(d.id);
      },
      error: e => {
        this.reassignSaving.set(false);
        this.toast.error('Error', e?.error?.message ?? 'Failed to reassign rider.');
      },
    });
  }

  riderInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  isCurrentRider(rider: NearbyRider): boolean {
    return rider.id === this.delivery()?.driverId;
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

  openEdit() {
    const d = this.delivery();
    if (!d) return;
    this.editForm = {
      status:         d.status,
      pickupAddress:  d.pickupAddress,
      dropoffAddress: d.dropoffAddress,
      description:    d.description ?? '',
      price:          d.price ?? null,
    };
    this.editError.set('');
    this.editModal.set(true);
  }

  closeEdit() {
    this.editError.set('');
    this.editModal.set(false);
  }

  saveEdit() {
    const d = this.delivery();
    if (!d) return;
    this.editSaving.set(true);
    const body: Record<string, unknown> = {
      status:         this.editForm.status,
      pickupAddress:  this.editForm.pickupAddress,
      dropoffAddress: this.editForm.dropoffAddress,
      price:          this.editForm.price ?? 0,
    };
    if (this.editForm.description) body['description'] = this.editForm.description;
    this.service.updateDelivery(d.id, body).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.closeEdit();
        this.loadDetail(d.id);
        this.toast.success('Updated', 'Delivery has been updated.');
      },
      error: e => {
        this.editSaving.set(false);
        this.editError.set(e?.error?.message ?? 'Failed to update delivery.');
      },
    });
  }

  goBack() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  // ── Map: init ─────────────────────────────────────────────────────────────────

  private initMap() {
    if (!this.mapEl?.nativeElement || this.map) return;
    this.map = L.map(this.mapEl.nativeElement, {
      center: [-17.8292, 31.0522],
      zoom:   12,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    const d = this.delivery();
    if (d) {
      this.placePins(d);
      this.drawDetailRoute(d);
    }
  }

  // ── Map: pickup / dropoff pins ────────────────────────────────────────────────

  private placePins(d: DeliveryDetailData) {
    if (!this.map) return;
    this.pinLayers.forEach(l => l.remove());
    this.pinLayers = [];

    const pickupIcon = L.icon({
      iconUrl: '/icons/pickup.svg', iconSize: [40, 53], iconAnchor: [20, 53], popupAnchor: [0, -53],
    });
    const dropoffIcon = L.icon({
      iconUrl: '/icons/dropoff.svg', iconSize: [40, 53], iconAnchor: [20, 53], popupAnchor: [0, -53],
    });

    const pts: L.LatLngExpression[] = [];

    if (d.pickupLat && d.pickupLng) {
      const pt: L.LatLngExpression = [d.pickupLat, d.pickupLng];
      pts.push(pt);
      this.pinLayers.push(
        L.marker(pt, { icon: pickupIcon })
          .bindPopup(`<b>Pickup</b><br><span style="font-size:12px">${d.pickupAddress}</span>`)
          .addTo(this.map!)
      );
    }
    if (d.dropoffLat && d.dropoffLng) {
      const pt: L.LatLngExpression = [d.dropoffLat, d.dropoffLng];
      pts.push(pt);
      this.pinLayers.push(
        L.marker(pt, { icon: dropoffIcon })
          .bindPopup(`<b>Dropoff</b><br><span style="font-size:12px">${d.dropoffAddress}</span>`)
          .addTo(this.map!)
      );
    }

    // Include rider in bounds if we already have a GPS fix
    const allPts: L.LatLngExpression[] = [...pts];
    if (this.riderState.lat !== null && this.riderState.lng !== null) {
      allPts.push([this.riderState.lat, this.riderState.lng]);
    }

    if (allPts.length >= 2) {
      this.map.fitBounds(L.latLngBounds(allPts), { padding: [48, 48], maxZoom: 15, animate: false });
    } else if (allPts.length === 1) {
      this.map.setView(allPts[0], 14);
    }
  }

  // ── Map: geometry helpers ─────────────────────────────────────────────────────

  private haversineM(a: L.LatLng, b: L.LatLng): number {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
            + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  private bearingDeg(a: L.LatLng, b: L.LatLng): number {
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const aLat = a.lat * Math.PI / 180, bLat = b.lat * Math.PI / 180;
    return (Math.atan2(
      Math.sin(dLng) * Math.cos(bLat),
      Math.cos(aLat) * Math.sin(bLat) - Math.sin(aLat) * Math.cos(bLat) * Math.cos(dLng)
    ) * 180 / Math.PI + 360) % 360;
  }

  // ── Map: chevrons ─────────────────────────────────────────────────────────────

  private makeChevronIcon(colour: string, bearing: number): L.DivIcon {
    return L.divIcon({
      html: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"
               style="transform:rotate(${bearing}deg);display:block">
               <path d="M2.1 9.8L7 3.5L11.9 9.8" stroke="${colour}" stroke-width="4.9" stroke-linecap="round" stroke-linejoin="round"/>
               <path d="M2.1 9.8L7 3.5L11.9 9.8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>`,
      iconSize: [14, 14], iconAnchor: [7, 7], className: '',
    });
  }

  private placeChevrons(path: L.LatLng[], colour: string) {
    if (!this.map || path.length < 2) return;
    const INTERVAL = 80, FIRST_OFFSET = 40;
    let accumulated = 0, nextAt = FIRST_OFFSET;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const segLen = this.haversineM(a, b);
      let walked = 0;
      while (walked + (nextAt - accumulated) <= segLen) {
        walked    += nextAt - accumulated;
        accumulated = nextAt;
        const t       = walked / segLen;
        const lat     = a.lat + t * (b.lat - a.lat);
        const lng     = a.lng + t * (b.lng - a.lng);
        const bearing = this.bearingDeg(a, b);
        const chevron = L.marker([lat, lng], {
          icon: this.makeChevronIcon(colour, bearing),
          interactive: false,
          zIndexOffset: -100,
        }).addTo(this.map!);
        this.routeLayers.push(chevron);
        nextAt += INTERVAL;
      }
      accumulated += segLen - walked;
    }
  }

  // ── Map: rider / bike pin ─────────────────────────────────────────────────────

  private makeRiderPin(bearing: number | null, ghost = false): L.DivIcon {
    const rotation = bearing !== null ? bearing - 90 : 0;
    const w = 58, h = 52;
    const style = ghost
      ? `opacity:0.45;filter:grayscale(100%);transform:rotate(${rotation}deg);transform-origin:${w / 2}px ${h / 2}px;display:block`
      : `transform:rotate(${rotation}deg);transform-origin:${w / 2}px ${h / 2}px;display:block`;
    return L.divIcon({
      html: `<img src="/icons/bike.svg" width="${w}" height="${h}" style="${style}" draggable="false"/>`,
      iconSize: [w, h], iconAnchor: [w / 2, h / 2], className: '',
    });
  }

  private updateRiderMarker() {
    if (!this.map || this.riderState.lat === null || this.riderState.lng === null) return;
    const pos   = L.latLng(this.riderState.lat, this.riderState.lng);
    const ghost = this.riderState.onlineStatus === 'OFFLINE';
    const icon  = this.makeRiderPin(this.riderState.bearing, ghost);
    if (this.riderMarker) {
      this.riderMarker.setLatLng(pos);
      this.riderMarker.setIcon(icon);
    } else {
      this.riderMarker = L.marker(pos, { icon, zIndexOffset: 2000 }).addTo(this.map);
    }
  }

  // ── Map: route drawing ────────────────────────────────────────────────────────

  private clearRouteLayers() {
    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];
  }

  private drawSegment(
    path: L.LatLng[], colour: string,
    opts: { dashed?: boolean; noChevrons?: boolean; weight?: number } = {},
  ) {
    if (!this.map || path.length < 2) return;
    const line = L.polyline(path, {
      color:     colour,
      weight:    opts.weight ?? 4,
      opacity:   opts.dashed ? 0.7 : 0.85,
      dashArray: opts.dashed ? '8 5' : undefined,
    }).addTo(this.map!);
    this.routeLayers.push(line);
    if (!opts.noChevrons) this.placeChevrons(path, colour);
  }

  private async fetchOsrm(fromLat: number, fromLng: number, toLat: number, toLng: number)
    : Promise<{ path: L.LatLng[]; durationSecs: number; distanceM: number } | null> {
    try {
      const url = `${environment.apiUrl}/location/route` +
        `?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`;
      const res  = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('tih_token') ?? ''}` },
      });
      const json = await res.json();
      const route = json.data;
      if (!route) return null;
      const path = (route.coordinates as [number, number][])
        .map(([lng, lat]) => L.latLng(lat, lng));
      return { path, durationSecs: route.durationSecs, distanceM: route.distanceM };
    } catch { return null; }
  }

  private straight(lat1: number, lng1: number, lat2: number, lng2: number): L.LatLng[] {
    return [L.latLng(lat1, lng1), L.latLng(lat2, lng2)];
  }

  private async drawDetailRoute(d: DeliveryDetailData) {
    if (!this.map) return;

    // Generation guard — prevents stale OSRM responses from clobbering newer draws
    const gen = ++this.drawGeneration;
    this.clearRouteLayers();
    this.detailEta.set(null);

    const hasPts    = d.pickupLat && d.pickupLng && d.dropoffLat && d.dropoffLng;
    if (!hasPts) return;

    const status    = d.status;
    const terminal  = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(status);
    const hasRider  = this.riderState.lat !== null && this.riderState.lng !== null;
    const isEnRoute = ['ASSIGNED', 'ACCEPTED'].includes(status);
    const isTransit = ['IN_TRANSIT', 'ARRIVED'].includes(status);

    // ── Terminal: gray dashed placeholder, no chevrons ────────────────────────
    if (terminal) {
      this.drawSegment(
        this.straight(d.pickupLat!, d.pickupLng!, d.dropoffLat!, d.dropoffLng!),
        '#9ca3af', { dashed: true, noChevrons: true, weight: 3 },
      );
      return;
    }

    // ── Live rider on map ─────────────────────────────────────────────────────
    if (hasRider && (isEnRoute || isTransit)) {
      const rLat = this.riderState.lat!, rLng = this.riderState.lng!;

      if (isEnRoute) {
        // Amber dashed: rider→pickup   Blue solid: pickup→dropoff
        const ph1 = this.straight(rLat, rLng, d.pickupLat!, d.pickupLng!);
        const ph2 = this.straight(d.pickupLat!, d.pickupLng!, d.dropoffLat!, d.dropoffLng!);
        this.drawSegment(ph1, '#f59e0b', { dashed: true, noChevrons: true, weight: 3 });
        this.drawSegment(ph2, '#3b82f6', { noChevrons: true });

        const [seg1, seg2] = await Promise.all([
          this.fetchOsrm(rLat, rLng, d.pickupLat!, d.pickupLng!),
          this.fetchOsrm(d.pickupLat!, d.pickupLng!, d.dropoffLat!, d.dropoffLng!),
        ]);
        if (!this.map || this.drawGeneration !== gen) return;
        this.clearRouteLayers();

        this.drawSegment(seg1?.path ?? ph1, '#f59e0b', { dashed: true });
        this.drawSegment(seg2?.path ?? ph2, '#3b82f6');

        if (seg1) {
          this.detailEta.set({
            mins:         Math.ceil(seg1.durationSecs / 60),
            distKm:       seg1.distanceM / 1000,
            label:        'to pickup',
            routeMins:    seg2 ? Math.ceil(seg2.durationSecs / 60) : undefined,
            routeDistKm:  seg2 ? seg2.distanceM / 1000 : undefined,
          });
        }

      } else {
        // Violet solid: rider→dropoff
        const ph = this.straight(rLat, rLng, d.dropoffLat!, d.dropoffLng!);
        this.drawSegment(ph, '#8b5cf6', { noChevrons: true });

        const seg = await this.fetchOsrm(rLat, rLng, d.dropoffLat!, d.dropoffLng!);
        if (!this.map || this.drawGeneration !== gen) return;
        this.clearRouteLayers();

        this.drawSegment(seg?.path ?? ph, '#8b5cf6');

        if (seg) {
          this.detailEta.set({
            mins:   Math.ceil(seg.durationSecs / 60),
            distKm: seg.distanceM / 1000,
            label:  'to dropoff',
          });
        }
      }

    } else {
      // No live rider: blue pickup→dropoff + delivery route ETA
      const ph = this.straight(d.pickupLat!, d.pickupLng!, d.dropoffLat!, d.dropoffLng!);
      this.drawSegment(ph, '#3b82f6', { noChevrons: true });

      const seg = await this.fetchOsrm(d.pickupLat!, d.pickupLng!, d.dropoffLat!, d.dropoffLng!);
      if (!this.map || this.drawGeneration !== gen) return;
      this.clearRouteLayers();

      this.drawSegment(seg?.path ?? ph, '#3b82f6');

      if (seg) {
        this.detailEta.set({
          mins:   Math.ceil(seg.durationSecs / 60),
          distKm: seg.distanceM / 1000,
          label:  'delivery route',
        });
      }

      // Ghost pin at pickup when rider is assigned but has no GPS yet
      if (d.driverId && d.pickupLat && d.pickupLng && !this.riderSeen) {
        const ghostIcon = this.makeRiderPin(null, true);
        if (this.riderMarker) {
          this.riderMarker.setLatLng([d.pickupLat, d.pickupLng]);
          this.riderMarker.setIcon(ghostIcon);
        } else {
          this.riderMarker = L.marker([d.pickupLat, d.pickupLng], {
            icon: ghostIcon, zIndexOffset: 500,
          }).addTo(this.map!);
        }
      } else if (!d.driverId) {
        // No rider at all — clear any lingering rider marker
        this.riderMarker?.remove();
        this.riderMarker         = null;
        this.riderSeen           = false;
        this.riderState.lat      = null;
        this.riderState.lng      = null;
        this.riderState.bearing  = null;
      }
    }
  }
}

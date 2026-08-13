import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, signal, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { OrgDashboardService, OrgDashboardStats } from './overview.service';
import { OrgDeliveryService, DeliveryItem } from '../deliveries/deliveries.service';
import { ShopService, Shop } from '../shops/shops.service';
import { UserService, NearbyRider } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';
import { DeliveryUiService } from '../deliveries/deliveries-ui.service';
import { DeliveryWebSocketService, RiderLocationEvent, DriverStatusEvent } from '../../../core/delivery-websocket.service';
import { OrgDriverLocation } from '../../../core/user.service';
import { environment } from '../../../../environments/environment';

/** Statuses that represent an in-flight delivery. */
const ACTIVE_STATUSES = new Set(['CREATED', 'PUBLISHED', 'ASSIGNED', 'ACCEPTED', 'DECLINED', 'IN_TRANSIT', 'ARRIVED']);

/** Live state for a single rider on the map. */
interface RiderState {
  riderId:    string;
  name:       string | null;
  deliveryId: string | null;
  lat:        number;
  lng:        number;
  bearing:    number | null;
  status:     string | null;
  /** "ONLINE" | "OFFLINE" — updated by driverStatusEvent and snapshot */
  onlineStatus: 'ONLINE' | 'OFFLINE';
  /** Epoch millis of last GPS fix — used for "last seen X ago" display */
  lastSeenTs: number;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DecimalPipe, RouterModule],
  templateUrl: './overview.html',
})
export class Overview implements OnInit, AfterViewInit, OnDestroy {

  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  dashboardStats  = signal<OrgDashboardStats | null>(null);
  statsLoading    = signal(false);

  loadDashboardStats() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.statsLoading.set(true);
    this.orgDashboardService.getStats(orgId).subscribe({
      next:  r => { this.dashboardStats.set(r.data); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
    });
  }

  // ── Deliveries ────────────────────────────────────────────────────────────────
  dashboardDeliveries      = signal<DeliveryItem[]>([]);
  dashboardDeliveryLoading = signal(false);
  viewMode                 = signal<'active' | 'past'>('active');
  deliverySearchQuery      = signal('');

  activeDeliveries = computed(() =>
    this.dashboardDeliveries().filter(d => ACTIVE_STATUSES.has(d.status))
  );
  pastDeliveries = computed(() =>
    this.dashboardDeliveries().filter(d => !ACTIVE_STATUSES.has(d.status))
  );
  filteredDeliveries = computed(() => {
    const base = this.viewMode() === 'active' ? this.activeDeliveries() : this.pastDeliveries();
    const q    = this.deliverySearchQuery().trim().toLowerCase();
    if (!q) return base;
    return base.filter(d =>
      (d.clientName    ?? '').toLowerCase().includes(q) ||
      (d.pickupAddress ?? '').toLowerCase().includes(q) ||
      (d.dropoffAddress ?? '').toLowerCase().includes(q)
    );
  });

  // ── Selection ─────────────────────────────────────────────────────────────────
  selectedDeliveryId      = signal<string | null>(null);
  deliveryPanelVisible    = signal(false);          // panel UI — independent of route drawing
  panelExpanded           = signal(false);          // false = compact strip, true = full panel
  selectedDelivery        = computed(() =>
    this.dashboardDeliveries().find(d => d.id === this.selectedDeliveryId()) ?? null
  );

  setViewMode(mode: 'active' | 'past') {
    this.viewMode.set(mode);
    this.selectedDeliveryId.set(null);
    this.deliveryPanelVisible.set(false);
    this.panelExpanded.set(false);
    this.refreshMapMarkers();
  }

  // ── Shops ─────────────────────────────────────────────────────────────────────
  shops = signal<Shop[]>([]);

  loadShops() {
    this.shopService.getAll(0, 100).subscribe({
      next:  r => { this.shops.set(r.data ?? []); this.refreshMapMarkers(); },
      error: () => {},
    });
  }

  // ── Live rider GPS state ──────────────────────────────────────────────────────
  /** Map of riderId → latest GPS position + bearing from WebSocket. */
  private riderStates = new Map<string, RiderState>();
  private riderMarkers = new Map<string, L.Marker>();

  /** Selected rider pin (for the click-on-pin detail panel). */
  selectedRiderState = signal<RiderState | null>(null);
  selectedRiderDelivery = computed(() => {
    const rs = this.selectedRiderState();
    if (!rs?.deliveryId) return null;
    return this.dashboardDeliveries().find(d => d.id === rs.deliveryId) ?? null;
  });

  dismissRiderPanel() {
    this.selectedRiderState.set(null);
  }

  // ── Quick actions on selected delivery ────────────────────────────────────────
  cancelling         = signal(false);
  publishing         = signal(false);
  showCancelConfirm  = signal(false);
  showPublishConfirm = signal(false);

  // Reassign
  showReassignModal = signal(false);
  reassignLoading   = signal(false);
  reassignSaving    = signal(false);
  reassignRiders    = signal<NearbyRider[]>([]);
  reassignOsrmOk    = signal(true);
  reassignRiderId   = signal<string | null>(null);

  canCancelSelected = computed(() => {
    const d = this.selectedDelivery();
    if (!d) return false;
    return !['DELIVERED', 'CANCELLED', 'FAILED', 'IN_TRANSIT'].includes(d.status);
  });
  canPublishSelected = computed(() => {
    const d = this.selectedDelivery();
    if (!d) return false;
    return ['ASSIGNED', 'DECLINED'].includes(d.status);
  });
  canReassignSelected = computed(() => {
    const d = this.selectedDelivery();
    if (!d) return false;
    return ['ASSIGNED', 'DECLINED'].includes(d.status);
  });

  confirmCancel() {
    const d = this.selectedDelivery();
    if (!d) return;
    this.showCancelConfirm.set(false);
    this.cancelling.set(true);
    this.orgDeliveryService.cancel(d.id).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.toast.success('Cancelled', 'Delivery has been cancelled.');
        this.loadDashboardDeliveries();
        this.selectedDeliveryId.set(null);
        this.deliveryPanelVisible.set(false);
      },
      error: e => {
        this.cancelling.set(false);
        this.toast.error('Error', e?.error?.message ?? 'Failed to cancel delivery.');
      },
    });
  }

  confirmPublish() {
    const d = this.selectedDelivery();
    if (!d) return;
    this.showPublishConfirm.set(false);
    this.publishing.set(true);
    this.orgDeliveryService.publish(d.id).subscribe({
      next: () => {
        this.publishing.set(false);
        this.toast.success('Published', 'Delivery published to open bidding.');
        this.loadDashboardDeliveries();
      },
      error: e => {
        this.publishing.set(false);
        this.toast.error('Error', e?.error?.message ?? 'Failed to publish delivery.');
      },
    });
  }

  openReassign() {
    const d = this.selectedDelivery();
    if (!d) return;
    this.showReassignModal.set(true);
    this.reassignRiderId.set(null);
    this.reassignLoading.set(true);
    this.userService.getNearbyRiders(d.pickupLat, d.pickupLng).subscribe({
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
    const d  = this.selectedDelivery();
    const id = this.reassignRiderId();
    if (!d || !id) return;
    this.reassignSaving.set(true);
    this.orgDeliveryService.reassign(d.id, id).subscribe({
      next: () => {
        this.reassignSaving.set(false);
        this.showReassignModal.set(false);
        this.toast.success('Reassigned', 'Rider has been reassigned successfully.');
        this.loadDashboardDeliveries();
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

  isCurrentRiderSelected(rider: NearbyRider): boolean {
    return rider.id === this.selectedDelivery()?.driverId;
  }

  // ── ETA for selected delivery ─────────────────────────────────────────────────
  selectedDeliveryEta = signal<{
    /** ETA of the active rider leg (rider→pickup or rider→dropoff). */
    mins:      number;
    distKm:    number;
    label:     string;   // 'to pickup' | 'to dropoff'
    /** Full pickup→dropoff route duration (shown alongside when rider is en-route to pickup). */
    routeMins?: number;
    routeDistKm?: number;
  } | null>(null);

  // ── Map ───────────────────────────────────────────────────────────────────────
  @ViewChild('dashboardMap') mapEl?: ElementRef;
  private map:              L.Map | null = null;
  private mapLayers:        L.Layer[]    = [];
  private routeLayers:      L.Layer[]    = [];   // route lines + chevrons — cleared on every refresh
  private deliveryMarkers   = new Map<string, { pickup?: L.Marker; dropoff?: L.Marker }>();
  private mapResizeObserver: ResizeObserver | null = null;
  private osrmCache         = new Map<string, L.LatLng[]>(); // pickup→dropoff only

  // ── Utility ───────────────────────────────────────────────────────────────────
  statusColour(status: string): string {
    const palette: Record<string, string> = {
      CREATED:    '#f97316',
      ASSIGNED:   '#f59e0b',
      ACCEPTED:   '#3b82f6',
      IN_TRANSIT: '#8b5cf6',
      ARRIVED:    '#10b981',
      PUBLISHED:  '#f97316',
      DECLINED:   '#ef4444',
      DELIVERED:  '#16a34a',
      CANCELLED:  '#ef4444',
    };
    return palette[status] ?? '#6b7280';
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  timeElapsed(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  strategyLabel(s: string | null): string {
    if (!s) return '';
    return { DIRECT_ASSIGN: 'Direct', INTERNAL_BID: 'Bid', PUBLIC_BID: 'Public' }[s] ?? s;
  }

  // ── Geometry helpers ──────────────────────────────────────────────────────────
  private haversineM(a: L.LatLng, b: L.LatLng): number {
    const R = 6_371_000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  private bearingDeg(a: L.LatLng, b: L.LatLng): number {
    const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
    const dLng  = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // ── Chevron rendering ─────────────────────────────────────────────────────────
  /** V-shaped chevron icon pointing in the direction of travel. */
  private makeChevronIcon(colour: string, bearing: number): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<svg width="14" height="14" viewBox="0 0 14 14"
                  style="transform:rotate(${bearing}deg);display:block;overflow:visible"
                  xmlns="http://www.w3.org/2000/svg">
               <path d="M2.1 9.8L7 3.5L11.9 9.8" fill="none"
                     stroke="${colour}" stroke-width="4.9"
                     stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>
               <path d="M2.1 9.8L7 3.5L11.9 9.8" fill="none"
                     stroke="white" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round"/>
             </svg>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
  }

  /** Walk a path and place a chevron every 80 m, first one at 40 m. */
  private placeChevrons(path: L.LatLng[], colour: string) {
    if (!this.map || path.length < 2) return;
    const intervalM = 80;
    let accumulated = intervalM / 2; // start mid-interval so first chevron is at 40 m

    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const segDist = this.haversineM(a, b);
      const bearing = this.bearingDeg(a, b);

      while (accumulated <= segDist) {
        const t = accumulated / segDist;
        const pt = L.latLng(a.lat + t * (b.lat - a.lat), a.lng + t * (b.lng - a.lng));
        const m  = L.marker(pt, { icon: this.makeChevronIcon(colour, bearing), interactive: false });
        m.addTo(this.map!);
        this.routeLayers.push(m);
        accumulated += intervalM;
      }
      accumulated -= segDist;
    }
  }

  // ── OSRM helpers ──────────────────────────────────────────────────────────────
  /** Fetch a single driving route via the backend proxy (cached in Redis). */
  private async fetchOsrmSegment(
    fromLat: number, fromLng: number, toLat: number, toLng: number,
  ): Promise<{ path: L.LatLng[]; durationSecs: number; distanceM: number }> {
    const url = `${environment.apiUrl}/location/route` +
      `?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`;
    const res  = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('tih_token') ?? ''}` },
    });
    const json = await res.json();
    const route = json.data;
    const coords: [number, number][] = route.coordinates;
    return {
      path:         coords.map(([lng, lat]) => L.latLng(lat, lng)),
      durationSecs: route.durationSecs as number,
      distanceM:    route.distanceM    as number,
    };
  }

  /** Get pickup→dropoff path — cached per delivery id. */
  private async getPickupDropoffPath(
    id: string, pLat: number, pLng: number, dLat: number, dLng: number,
  ): Promise<L.LatLng[]> {
    if (this.osrmCache.has(id)) return this.osrmCache.get(id)!;
    const result = await this.fetchOsrmSegment(pLat, pLng, dLat, dLng);
    this.osrmCache.set(id, result.path);
    return result.path;
  }

  /** Straight-line fallback path between two points. */
  private straightPath(lat1: number, lng1: number, lat2: number, lng2: number): L.LatLng[] {
    return [L.latLng(lat1, lng1), L.latLng(lat2, lng2)];
  }

  /** Draw a polyline + chevrons and track layers for cleanup. */
  private drawSegment(
    path: L.LatLng[], colour: string,
    opts: { dashed?: boolean; weight?: number; noChevrons?: boolean },
  ) {
    if (!this.map) return;
    const line = L.polyline(path, {
      color:     colour,
      weight:    opts.weight ?? 4,
      opacity:   0.85,
      dashArray: opts.dashed ? '10 6' : undefined,
    }).addTo(this.map!);
    this.routeLayers.push(line);
    // Chevrons on all OSRM road paths — skip only for raw straight-line placeholders
    if (!opts.noChevrons) this.placeChevrons(path, colour);
  }

  /**
   * Full route orchestrator — called after pins are placed.
   * Draws placeholder lines immediately, then replaces with OSRM road geometry + chevrons.
   */
  private async drawSelectedDeliveryRoute(d: DeliveryItem) {
    if (!this.map || !d.pickupLat || !d.pickupLng || !d.dropoffLat || !d.dropoffLng) return;

    const pLat = d.pickupLat, pLng = d.pickupLng;
    const drLat = d.dropoffLat, drLng = d.dropoffLng;

    // Find rider GPS from riderStates (keyed by riderId; deliveryId links them)
    const riderState = d.driverId
      ? [...this.riderStates.values()].find(rs => rs.deliveryId === d.id || rs.riderId === d.driverId)
      : null;

    const hasRider    = !!(riderState?.lat && riderState?.lng);
    const isEnRoute   = ['ASSIGNED', 'ACCEPTED'].includes(d.status);
    const isInTransit = ['IN_TRANSIT', 'ARRIVED'].includes(d.status);
    const isTerminal  = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status);

    // ── 1. Draw placeholder straight lines immediately ──────────────────────────
    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];

    if (hasRider && isEnRoute) {
      this.drawSegment(this.straightPath(riderState!.lat, riderState!.lng, pLat, pLng),
        '#f59e0b', { dashed: true, noChevrons: true });
      this.drawSegment(this.straightPath(pLat, pLng, drLat, drLng),
        '#3b82f6', { dashed: true, noChevrons: true });
    } else if (hasRider && isInTransit) {
      this.drawSegment(this.straightPath(riderState!.lat, riderState!.lng, drLat, drLng),
        '#8b5cf6', { dashed: true, noChevrons: true });
    } else {
      const colour = isTerminal ? '#6b7280' : '#3b82f6';
      this.drawSegment(this.straightPath(pLat, pLng, drLat, drLng),
        colour, { dashed: true, weight: 3, noChevrons: true });
    }

    // ── 2. Fetch OSRM segments and replace ─────────────────────────────────────
    try {
      if (hasRider && isEnRoute) {
        const [riderLeg, routeLeg] = await Promise.all([
          this.fetchOsrmSegment(riderState!.lat, riderState!.lng, pLat, pLng),
          this.fetchOsrmSegment(pLat, pLng, drLat, drLng).then(r => {
            this.osrmCache.set(d.id, r.path); return r;
          }),
        ]);
        if (this.selectedDeliveryId() !== d.id || !this.map) return;
        this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];

        this.drawSegment(riderLeg.path,  '#f59e0b', { dashed: true }); // amber dashed + chevrons — rider approach
        this.drawSegment(routeLeg.path,  '#3b82f6', {});               // blue solid  + chevrons — delivery route
        this.selectedDeliveryEta.set({
          mins:        Math.max(1, Math.round(riderLeg.durationSecs / 60)),
          distKm:      riderLeg.distanceM / 1000,
          label:       'to pickup',
          routeMins:   Math.max(1, Math.round(routeLeg.durationSecs / 60)),
          routeDistKm: routeLeg.distanceM / 1000,
        });

      } else if (hasRider && isInTransit) {
        const leg = await this.fetchOsrmSegment(riderState!.lat, riderState!.lng, drLat, drLng);
        if (this.selectedDeliveryId() !== d.id || !this.map) return;
        this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];

        this.drawSegment(leg.path, '#8b5cf6', {}); // violet solid — rider to dropoff
        this.selectedDeliveryEta.set({
          mins:   Math.max(1, Math.round(leg.durationSecs / 60)),
          distKm: leg.distanceM / 1000,
          label:  'to dropoff',
        });

      } else if (!isTerminal) {
        // No rider GPS — fetch route and still show delivery duration as ETA
        const seg = await this.fetchOsrmSegment(pLat, pLng, drLat, drLng);
        this.osrmCache.set(d.id, seg.path);
        if (this.selectedDeliveryId() !== d.id || !this.map) return;
        this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];

        this.drawSegment(seg.path, '#3b82f6', {}); // blue solid + chevrons
        this.selectedDeliveryEta.set({
          mins:   Math.max(1, Math.round(seg.durationSecs / 60)),
          distKm: seg.distanceM / 1000,
          label:  'delivery route',
        });

      } else {
        // Terminal — keep placeholder, no chevrons
      }
    } catch { /* keep whatever placeholder was drawn */ }
  }

  // ── Pin factories ──────────────────────────────────────────────────────────────

  /** Teardrop pickup pin — small (unselected) or large (selected). */
  private makePickupPin(selected = false): L.Icon {
    const w = selected ? 40 : 28, h = selected ? 53 : 37;
    return L.icon({
      iconUrl:      '/icons/pickup.svg',
      iconSize:     [w, h],
      iconAnchor:   [w / 2, h],
      popupAnchor:  [0, -h],
    });
  }

  /** Teardrop dropoff pin — small (unselected) or large (selected). */
  private makeDropoffPin(selected = false): L.Icon {
    const w = selected ? 40 : 28, h = selected ? 53 : 37;
    return L.icon({
      iconUrl:      '/icons/dropoff.svg',
      iconSize:     [w, h],
      iconAnchor:   [w / 2, h],
      popupAnchor:  [0, -h],
    });
  }

  private shopPin(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="background:#16a34a;width:18px;height:18px;border-radius:5px;
              border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);
              display:flex;align-items:center;justify-content:center">
               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="white" viewBox="0 0 24 24">
                 <path d="M3 9l1-6h16l1 6v2a2 2 0 01-2 2v8H5v-8a2 2 0 01-2-2V9z"/>
               </svg>
             </div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
  }

  /**
   * Rider pin using bike.svg.
   *
   * State logic:
   *   ghost    — rider assigned but no live GPS (faded gray at pickup)
   *   offline  — rider went offline; pin shown at last-known position, grayed
   * States → color:
   *   offline     → red   (hue-rotate to red)
   *   online/idle → green (hue-rotate to green)
   *   on delivery → blue  (bike.svg native color)
   *   ghost       → faded gray (assigned, no GPS yet)
   */
  private makeRiderPin(
    bearing:  number | null,
    ghost     = false,
    offline   = false,
    idle      = false,
  ): L.DivIcon {
    const rotation = bearing != null ? bearing - 90 : 0;
    const w = 58, h = 52, ax = 26, ay = 26;

    let filter = '';
    if (ghost)        filter = 'grayscale(100%) opacity(0.4)';
    else if (offline) filter = 'hue-rotate(139deg) saturate(1.5) brightness(0.9)'; // #2563EB → red
    else if (idle)    filter = 'hue-rotate(259deg) saturate(1.3)';                 // #2563EB → green

    const imgStyle = [
      'display:block',
      `transform:rotate(${rotation}deg)`,
      `transform-origin:${ax}px ${ay}px`,
      filter ? `filter:${filter}` : '',
    ].filter(Boolean).join(';');

    return L.divIcon({
      className: '',
      html: `<img src="/icons/bike.svg" width="${w}" height="${h}" style="${imgStyle}" draggable="false"/>`,
      iconSize:   [w, h],
      iconAnchor: [ax, ay],
    });
  }

  /** Grayed-out bike shown when a rider is assigned but hasn't sent GPS yet. */
  private makeGhostRiderPin(): L.DivIcon {
    return this.makeRiderPin(null, true, false, false);
  }

  private lastSeenLabel(ts: number): string {
    if (!ts) return 'Never';
    const mins = Math.floor((Date.now() - ts) / 60_000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  /**
   * True when the selected delivery's assigned rider is offline
   * but has a last-known GPS position to show on the map.
   * Used by the template to swap "Live ETA" labels for "last known" labels.
   */
  selectedRiderOffline(): boolean {
    const d = this.selectedDelivery();
    if (!d?.driverId) return false;
    const rs = [...this.riderStates.values()].find(
      r => r.riderId === d.driverId || r.deliveryId === d.id,
    );
    return rs?.onlineStatus === 'OFFLINE' && rs.lat != null && rs.lng != null;
  }

  /** Formatted last-seen label for the selected delivery's rider. */
  selectedRiderLastSeen(): string {
    const d = this.selectedDelivery();
    if (!d?.driverId) return '';
    const rs = [...this.riderStates.values()].find(
      r => r.riderId === d.driverId || r.deliveryId === d.id,
    );
    return rs?.lastSeenTs ? this.lastSeenLabel(rs.lastSeenTs) : '';
  }

  // ── Map lifecycle ─────────────────────────────────────────────────────────────
  initDashboardMap() {
    if (!this.mapEl?.nativeElement || this.map) return;
    this.map = L.map(this.mapEl.nativeElement, {
      center: [-17.8292, 31.0522],
      zoom: 12,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.refreshMapMarkers();

    this.mapResizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.mapResizeObserver.observe(this.mapEl!.nativeElement);
  }

  refreshMapMarkers() {
    if (!this.map) return;

    // Clear delivery/shop markers and route layers
    this.mapLayers.forEach(l => l.remove());
    this.mapLayers = [];
    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];
    this.deliveryMarkers.clear();

    const selId = this.selectedDeliveryId();

    // Shop pins
    for (const shop of this.shops()) {
      if (shop.latitude && shop.longitude) {
        const m = L.marker([shop.latitude, shop.longitude], { icon: this.shopPin() })
          .bindPopup(`<b>${shop.name}</b><br><span style="color:#6b7280;font-size:12px">${shop.address ?? ''}</span>`)
          .addTo(this.map!);
        this.mapLayers.push(m);
      }
    }

    // Delivery pins — active deliveries + the selected delivery (even if terminal/past)
    const selectedPast = selId
      ? this.dashboardDeliveries().find(d => d.id === selId && !ACTIVE_STATUSES.has(d.status))
      : undefined;
    const deliveriesToPin = selectedPast
      ? [...this.activeDeliveries(), selectedPast]
      : this.activeDeliveries();

    let selectedDelivery: DeliveryItem | undefined;
    for (const d of deliveriesToPin) {
      const sel   = d.id === selId;
      const entry: { pickup?: L.Marker; dropoff?: L.Marker } = {};
      if (sel) selectedDelivery = d;

      if (d.pickupLat && d.pickupLng) {
        const m = L.marker([d.pickupLat, d.pickupLng], {
          icon: this.makePickupPin(sel), zIndexOffset: sel ? 1000 : 0,
        }).bindPopup(this.makePopupHtml(d, 'pickup')).addTo(this.map!);
        entry.pickup = m;
        this.mapLayers.push(m);
      }
      if (d.dropoffLat && d.dropoffLng) {
        const m = L.marker([d.dropoffLat, d.dropoffLng], {
          icon: this.makeDropoffPin(sel), zIndexOffset: sel ? 1000 : 0,
        }).bindPopup(this.makePopupHtml(d, 'dropoff')).addTo(this.map!);
        entry.dropoff = m;
        this.mapLayers.push(m);
      }
      this.deliveryMarkers.set(d.id, entry);
    }

    // Draw route + chevrons for selected delivery
    if (selectedDelivery) {
      this.drawSelectedDeliveryRoute(selectedDelivery);
    } else {
      this.selectedDeliveryEta.set(null);
    }

    // Refresh rider pins (separate — cheap GPS update path)
    this.refreshRiderMarkers();
  }

  /** Refresh only the rider pins — called on every GPS update without rebuilding all delivery pins. */
  private refreshRiderMarkers() {
    if (!this.map) return;

    this.riderMarkers.forEach(m => m.remove());
    this.riderMarkers.clear();

    const selDelivery = this.dashboardDeliveries().find(d => d.id === this.selectedDeliveryId());
    const selRiderId  = selDelivery?.driverId ?? null;
    let selectedRiderSeen = false;

    for (const rs of this.riderStates.values()) {
      if (!rs.lat || !rs.lng) continue; // never sent GPS

      const delivery   = this.dashboardDeliveries().find(d => d.id === rs.deliveryId);
      const isSel      = rs.riderId === selRiderId || rs.deliveryId === this.selectedDeliveryId();
      const isOffline  = rs.onlineStatus === 'OFFLINE';
      const isIdle     = !isOffline && !rs.deliveryId;

      if (isSel) selectedRiderSeen = true;

      const icon   = this.makeRiderPin(rs.bearing, false, isOffline, isIdle);
      const zIndex = isOffline ? 500 : 2000;
      const marker = L.marker([rs.lat, rs.lng], { icon, zIndexOffset: zIndex });

      const riderName  = rs.name ?? delivery?.driverName ?? 'Rider';
      const statusText = isOffline ? 'Offline' : isIdle ? 'Online' : 'On delivery';
      const statusColor = isOffline ? '#ef4444' : isIdle ? '#16a34a' : '#3b82f6';
      const lastUpdated = rs.lastSeenTs
        ? `Last updated: ${this.lastSeenLabel(rs.lastSeenTs)}`
        : 'No GPS data';

      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:140px;padding:2px 0">
          <b style="font-size:13px">${riderName}</b>
          <div style="font-size:11px;font-weight:600;color:${statusColor};margin-top:4px">${statusText}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${lastUpdated}</div>
        </div>`,
        { closeButton: false, autoPan: false }
      );

      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout',  () => marker.closePopup());
      marker.on('click', () => {
        this.selectedRiderState.set(rs);
        this.selectedDeliveryId.set(null);
        this.refreshMapMarkers();
      });

      marker.addTo(this.map!);
      this.riderMarkers.set(rs.riderId, marker);
    }

    // Ghost pin — selected delivery has a rider assigned but no GPS at all yet
    if (selDelivery?.driverId && !selectedRiderSeen && selDelivery.pickupLat && selDelivery.pickupLng) {
      const ghost = L.marker([selDelivery.pickupLat, selDelivery.pickupLng], {
        icon: this.makeGhostRiderPin(), zIndexOffset: 2500,
      }).bindPopup(`
        <div style="font-family:system-ui;min-width:150px;padding:2px 0">
          <b style="font-size:13px">${selDelivery.driverName ?? 'Rider'}</b>
          <div style="font-size:11px;color:#f59e0b;margin-top:3px;font-weight:600">
            ⚠ Position not yet available
          </div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">
            Awaiting first GPS signal
          </div>
        </div>`);
      ghost.addTo(this.map!);
      this.riderMarkers.set('__ghost__' + selDelivery.driverId, ghost as unknown as L.Marker);
    }
  }

  private makePopupHtml(d: DeliveryItem, type: 'pickup' | 'dropoff'): string {
    const addr   = type === 'pickup' ? d.pickupAddress : d.dropoffAddress;
    const colour = type === 'pickup' ? '#22c55e' : '#ef4444';
    return `
      <div style="font-family:system-ui;min-width:160px;padding:2px 0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="width:8px;height:8px;border-radius:50%;background:${colour};display:inline-block;flex-shrink:0"></span>
          <b style="font-size:13px">${d.clientName ?? 'Dispatch'}</b>
        </div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:2px">${type === 'pickup' ? '↑ Pickup' : '↓ Dropoff'}</div>
        <div style="font-size:12px;color:#111827;line-height:1.4">${addr}</div>
        ${d.driverName ? `<div style="font-size:11px;color:#16a34a;margin-top:4px">Rider: ${d.driverName}</div>` : ''}
        <div style="font-size:11px;color:#6b7280;margin-top:2px">$${d.price.toFixed(2)}</div>
      </div>`;
  }

  focusDelivery(item: DeliveryItem) {
    const isSame    = this.selectedDeliveryId() === item.id;
    const panelOpen = this.deliveryPanelVisible();

    if (isSame && panelOpen) {
      // Panel already open for this delivery — just close panel, keep route on map
      this.deliveryPanelVisible.set(false);
      this.panelExpanded.set(false);
      return;
    }

    if (isSame && !panelOpen) {
      // Re-open panel for already-selected delivery (route already drawn)
      this.deliveryPanelVisible.set(true);
      this.panelExpanded.set(false);
      return;
    }

    // New delivery selected — switch route + open panel (collapsed strip)
    this.selectedDeliveryId.set(item.id);
    this.deliveryPanelVisible.set(true);
    this.panelExpanded.set(false);
    this.selectedRiderState.set(null);
    this.refreshMapMarkers();

    if (!this.map) return;
    const riderState = item.driverId
      ? [...this.riderStates.values()].find(rs => rs.deliveryId === item.id || rs.riderId === item.driverId)
      : null;
    const pts: L.LatLngExpression[] = [];
    if (riderState?.lat && riderState?.lng)  pts.push([riderState.lat,  riderState.lng]);
    if (item.pickupLat  && item.pickupLng)   pts.push([item.pickupLat,  item.pickupLng]);
    if (item.dropoffLat && item.dropoffLng)  pts.push([item.dropoffLat, item.dropoffLng]);
    if (pts.length >= 2) {
      this.map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15, animate: true, duration: 0.8 });
    } else if (pts.length === 1) {
      this.map.flyTo(pts[0], 15, { duration: 0.8 });
    }
  }

  loadDashboardDeliveries() {
    this.dashboardDeliveryLoading.set(true);
    this.orgDeliveryService.getBoard().subscribe({
      next: r => {
        this.dashboardDeliveries.set(Array.isArray(r.data) ? r.data : []);
        this.refreshMapMarkers();
        this.dashboardDeliveryLoading.set(false);
      },
      error: () => this.dashboardDeliveryLoading.set(false),
    });
  }

  /** One-shot snapshot: seeds riderStates with all org drivers (online + offline). */
  loadRiderSnapshot() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.userService.getOrgDriverLocations(orgId).subscribe({
      next: r => {
        for (const d of (r.data ?? [])) {
          if (!d.latitude || !d.longitude) continue; // never sent GPS
          // Don't overwrite a rider already tracked by live GPS
          if (this.riderStates.has(d.driverId)) continue;
          this.riderStates.set(d.driverId, {
            riderId:      d.driverId,
            name:         d.driverName,
            deliveryId:   d.deliveryId,
            lat:          d.latitude,
            lng:          d.longitude,
            bearing:      null,
            status:       null,
            onlineStatus: d.online ? 'ONLINE' : 'OFFLINE',
            lastSeenTs:   d.lastSeenTs,
          });
        }
        this.refreshRiderMarkers();
      },
      error: () => {},
    });
  }

  destroyDashboardMap() {
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = null;
    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];
    if (this.map) { this.map.remove(); this.map = null; }
    this.mapLayers = [];
    this.deliveryMarkers.clear();
    this.riderMarkers.forEach(m => m.remove());
    this.riderMarkers.clear();
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────────
  private boardSub:           Subscription | null = null;
  private locationSub:        Subscription | null = null;
  private driverStatusSub:    Subscription | null = null;
  private routeRedrawTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private orgDashboardService: OrgDashboardService,
    private orgDeliveryService:  OrgDeliveryService,
    private shopService:         ShopService,
    private userService:         UserService,
    private toast:               ToastService,
    private deliveryUiService:   DeliveryUiService,
    private ws:                  DeliveryWebSocketService,
  ) {}

  openNewDelivery() { this.deliveryUiService.open(); }

  ngOnInit() {
    this.loadDashboardStats();
    this.loadDashboardDeliveries();
    this.loadShops();
    this.loadRiderSnapshot();   // seed all org riders (online + offline) on load

    // Board events — patch delivery list in real-time.
    // Toasts are fired globally by the OrgDashboard shell, not here.
    this.boardSub = this.ws.boardEvents$.subscribe(evt => {
      const data      = evt.data as Record<string, unknown>;
      const evtId     = String(data['id'] ?? data['deliveryId'] ?? '');
      const newStatus = String(data['status'] ?? '');

      // Patch delivery in list
      if (evtId) {
        this.dashboardDeliveries.update(list => {
          const idx = list.findIndex(d => d.id === evtId);
          if (idx < 0) return list;
          const updated = { ...list[idx] };
          if (newStatus)          updated.status     = newStatus;
          if (data['driverName']) updated.driverName = String(data['driverName']);
          if (data['driverId'])   updated.driverId   = String(data['driverId']);
          const next = [...list]; next[idx] = updated;
          return next;
        });
        this.refreshMapMarkers();
      }

      // Reload stats on terminal transitions
      if (evt.type === 'dispatchStatusUpdatedEvent' && newStatus === 'DELIVERED') {
        this.loadDashboardStats();
      } else if (evt.type === 'dispatchCancelledEvent') {
        this.loadDashboardStats();
      }
    });

    // Rider GPS events — update pin on map
    this.locationSub = this.ws.riderLocations$.subscribe((evt: RiderLocationEvent) => {
      if (!evt.riderId || !evt.lat || !evt.lng) return;

      const wasTracked = this.riderStates.has(evt.riderId);
      const existing   = this.riderStates.get(evt.riderId);
      this.riderStates.set(evt.riderId, {
        riderId:      evt.riderId,
        name:         existing?.name         ?? null,
        deliveryId:   evt.deliveryId         ?? existing?.deliveryId ?? null,
        lat:          evt.lat,
        lng:          evt.lng,
        bearing:      evt.bearing            ?? existing?.bearing    ?? null,
        status:       evt.status             ?? existing?.status     ?? null,
        onlineStatus: 'ONLINE',
        lastSeenTs:   Date.now(),
      });

      // Update the bike pin
      this.refreshRiderMarkers();

      // If this GPS belongs to the selected delivery's rider, fix the route.
      // First appearance → immediate redraw (fixes the "wrong route on first click" bug).
      // Subsequent pings → debounced 30 s so we don't hammer OSRM every 2 s.
      const sel        = this.selectedDelivery();
      const isSelRider = sel && (sel.driverId === evt.riderId || evt.deliveryId === sel.id);
      if (isSelRider) {
        if (!wasTracked) {
          // Rider just came online — redraw immediately with correct rider-aware route
          this.drawSelectedDeliveryRoute(sel!);
        } else {
          // Rider is moving — debounce route refresh
          if (this.routeRedrawTimeout) clearTimeout(this.routeRedrawTimeout);
          this.routeRedrawTimeout = setTimeout(() => {
            const current = this.selectedDelivery();
            if (current) this.drawSelectedDeliveryRoute(current);
            this.routeRedrawTimeout = null;
          }, 30_000);
        }
      }
    });

    // Driver ONLINE / OFFLINE status events
    this.driverStatusSub = this.ws.driverStatus$.subscribe((evt: DriverStatusEvent) => {
      if (!evt.riderId) return;
      const existing = this.riderStates.get(evt.riderId);

      if (evt.status === 'OFFLINE') {
        // Keep them on the map at last-known position, just mark offline
        if (existing) {
          this.riderStates.set(evt.riderId, {
            ...existing,
            onlineStatus: 'OFFLINE',
            lastSeenTs:   evt.lastSeenTs || existing.lastSeenTs,
            lat:          evt.lat        ?? existing.lat,
            lng:          evt.lng        ?? existing.lng,
          });
        } else if (evt.lat && evt.lng) {
          this.riderStates.set(evt.riderId, {
            riderId:      evt.riderId,
            name:         evt.riderName,
            deliveryId:   evt.deliveryId,
            lat:          evt.lat,
            lng:          evt.lng,
            bearing:      null,
            status:       null,
            onlineStatus: 'OFFLINE',
            lastSeenTs:   evt.lastSeenTs,
          });
        }
      } else {
        // ONLINE — update or create entry; full position comes from next GPS ping
        this.riderStates.set(evt.riderId, {
          riderId:      evt.riderId,
          name:         evt.riderName ?? existing?.name ?? null,
          deliveryId:   evt.deliveryId ?? existing?.deliveryId ?? null,
          lat:          evt.lat        ?? existing?.lat  ?? 0,
          lng:          evt.lng        ?? existing?.lng  ?? 0,
          bearing:      existing?.bearing ?? null,
          status:       existing?.status  ?? null,
          onlineStatus: 'ONLINE',
          lastSeenTs:   evt.lastSeenTs || existing?.lastSeenTs || Date.now(),
        });
      }
      this.refreshRiderMarkers();
    });
  }

  ngAfterViewInit() { setTimeout(() => this.initDashboardMap(), 0); }

  ngOnDestroy() {
    this.boardSub?.unsubscribe();
    this.locationSub?.unsubscribe();
    this.driverStatusSub?.unsubscribe();
    if (this.routeRedrawTimeout) clearTimeout(this.routeRedrawTimeout);
    this.destroyDashboardMap();
  }
}

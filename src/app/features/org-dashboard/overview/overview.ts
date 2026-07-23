import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, signal, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import { GooglePlacesDirective, PlaceResult } from '../../../core/directives/google-places.directive';
import { OrgDashboardService, OrgDashboardStats } from './overview.service';
import { OrgDeliveryService, DeliveryItem } from '../deliveries/deliveries.service';
import { ShopService, Shop } from '../shops/shops.service';
import { UserService } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';
import { DeliveryUiService } from '../deliveries/deliveries-ui.service';

/** Statuses that represent an in-flight delivery */
const ACTIVE_STATUSES = new Set(['ASSIGNED', 'ACCEPTED', 'IN_TRANSIT', 'ARRIVED', 'PUBLISHED']);

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DecimalPipe, GooglePlacesDirective],
  templateUrl: './overview.html',
})
export class Overview implements OnInit, AfterViewInit, OnDestroy {

  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  // ── Stats ────────────────────────────────────────────────────────────────────
  dashboardStats = signal<OrgDashboardStats | null>(null);
  statsLoading   = signal(false);

  loadDashboardStats() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.statsLoading.set(true);
    this.orgDashboardService.getStats(orgId).subscribe({
      next:  r => { this.dashboardStats.set(r.data); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
    });
  }

  // ── Deliveries ───────────────────────────────────────────────────────────────
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
    const q = this.deliverySearchQuery().trim().toLowerCase();
    if (!q) return base;
    return base.filter(d =>
      (d.clientName    ?? '').toLowerCase().includes(q) ||
      (d.pickupAddress ?? '').toLowerCase().includes(q) ||
      (d.dropoffAddress ?? '').toLowerCase().includes(q)
    );
  });

  // ── Selection ────────────────────────────────────────────────────────────────
  selectedDeliveryId = signal<string | null>(null);
  selectedDelivery   = computed(() =>
    this.dashboardDeliveries().find(d => d.id === this.selectedDeliveryId()) ?? null
  );

  sidebarOpen = signal(true);

  setViewMode(mode: 'active' | 'past') {
    this.viewMode.set(mode);
    this.selectedDeliveryId.set(null);
    this.refreshMapMarkers();
  }

  // ── Shops ────────────────────────────────────────────────────────────────────
  shops = signal<Shop[]>([]);

  loadShops() {
    this.shopService.getAll(0, 100).subscribe({
      next:  r => { this.shops.set(r.data ?? []); this.refreshMapMarkers(); },
      error: () => {},
    });
  }

  // ── Edit delivery modal ──────────────────────────────────────────────────────
  editDeliveryModal      = signal(false);
  editDeliveryItem       = signal<DeliveryItem | null>(null);
  editDeliverySaving     = signal(false);
  editDeliveryModalError = signal('');
  editForm = {
    pickupAddress: '', dropoffAddress: '',
    description: '', price: null as number | null,
    paymentMethod: 'CASH', status: '',
  };

  openEditDelivery(item: DeliveryItem) {
    this.editDeliveryItem.set(item);
    this.editForm = {
      pickupAddress:  item.pickupAddress  ?? '',
      dropoffAddress: item.dropoffAddress ?? '',
      description:    item.description    ?? '',
      price:          item.price          ?? null,
      paymentMethod:  item.paymentStatus  ?? 'CASH',
      status:         item.status,
    };
    this.editDeliveryModalError.set('');
    this.editDeliveryModal.set(true);
  }

  closeEditDelivery() {
    this.editDeliveryModalError.set('');
    this.editDeliveryModal.set(false);
  }

  saveEditDelivery() {
    const orgId = this.orgId();
    const item  = this.editDeliveryItem();
    if (!orgId || !item) return;
    this.editDeliverySaving.set(true);
    const body: Record<string, unknown> = {
      pickupAddress:  this.editForm.pickupAddress,
      dropoffAddress: this.editForm.dropoffAddress,
      price:          this.editForm.price ?? 0,
      status:         this.editForm.status,
    };
    if (this.editForm.description) body['description'] = this.editForm.description;
    this.orgDeliveryService.updateDelivery(item.id, body).subscribe({
      next: () => {
        this.editDeliverySaving.set(false);
        this.closeEditDelivery();
        this.loadDashboardDeliveries();
        this.toast.success('Success', 'Delivery updated.');
      },
      error: e => {
        this.editDeliverySaving.set(false);
        this.editDeliveryModalError.set(e?.error?.message ?? 'Failed to update delivery.');
      },
    });
  }

  onEditPickupSelected(p: PlaceResult)  { this.editForm.pickupAddress  = p.address; }
  onEditDropoffSelected(p: PlaceResult) { this.editForm.dropoffAddress = p.address; }

  // ── Map ──────────────────────────────────────────────────────────────────────
  @ViewChild('dashboardMap') mapEl?: ElementRef;
  private map: L.Map | null = null;
  private mapLayers: L.Layer[] = [];
  private routeLayer: L.Polyline | null = null;
  private deliveryMarkers = new Map<string, { pickup?: L.Marker; dropoff?: L.Marker }>();
  private mapResizeObserver: ResizeObserver | null = null;

  // ── Utility ──────────────────────────────────────────────────────────────────
  statusColour(status: string): string {
    const palette: Record<string, string> = {
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
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // ── Pin factories ─────────────────────────────────────────────────────────────
  /** Large labelled pin (A/B) for the selected delivery */
  private makeLabelPin(colour: string, label: string): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="background:${colour};width:30px;height:30px;border-radius:50%;
              border:3px solid white;
              box-shadow:0 0 0 3px ${colour}55,0 3px 10px rgba(0,0,0,.4);
              display:flex;align-items:center;justify-content:center">
               <span style="color:white;font-size:12px;font-weight:700;font-family:system-ui;line-height:1">${label}</span>
             </div>`,
      iconSize:   [30, 30],
      iconAnchor: [15, 15],
    });
  }

  /** Small dot pin for non-selected deliveries */
  private makePin(colour: string, label: string): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="background:${colour};width:12px;height:12px;border-radius:50%;
              border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)" title="${label}"></div>`,
      iconSize:   [12, 12],
      iconAnchor: [6, 6],
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
      iconSize:   [18, 18],
      iconAnchor: [9, 9],
    });
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

    // Reflow map whenever its container is resized (e.g. shell sidebar collapse)
    this.mapResizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.mapResizeObserver.observe(this.mapEl!.nativeElement);
  }

  refreshMapMarkers() {
    if (!this.map) return;
    this.mapLayers.forEach(l => l.remove());
    this.mapLayers = [];
    this.deliveryMarkers.clear();
    if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; }

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

    // Delivery pins — show all, highlight selected
    for (const d of this.dashboardDeliveries()) {
      const colour = this.statusColour(d.status);
      const sel    = d.id === selId;
      const entry: { pickup?: L.Marker; dropoff?: L.Marker } = {};

      if (d.pickupLat && d.pickupLng) {
        const icon = sel
          ? this.makeLabelPin(colour, 'A')
          : this.makePin(colour, `↑ ${d.clientName ?? d.status}`);
        const m = L.marker([d.pickupLat, d.pickupLng], { icon, zIndexOffset: sel ? 1000 : 0 })
          .bindPopup(this.makePopupHtml(d, 'pickup'))
          .addTo(this.map!);
        if (sel) m.openPopup();
        entry.pickup = m;
        this.mapLayers.push(m);
      }

      if (d.dropoffLat && d.dropoffLng) {
        const icon = sel
          ? this.makeLabelPin('#ef4444', 'B')
          : this.makePin('#ef4444', `↓ ${d.clientName ?? d.status}`);
        const m = L.marker([d.dropoffLat, d.dropoffLng], { icon, zIndexOffset: sel ? 1000 : 0 })
          .bindPopup(this.makePopupHtml(d, 'dropoff'))
          .addTo(this.map!);
        entry.dropoff = m;
        this.mapLayers.push(m);
      }

      this.deliveryMarkers.set(d.id, entry);

      // Dashed route line for the selected delivery
      if (sel && d.pickupLat && d.pickupLng && d.dropoffLat && d.dropoffLng) {
        this.routeLayer = L.polyline(
          [[d.pickupLat, d.pickupLng], [d.dropoffLat, d.dropoffLng]],
          { color: colour, weight: 3, dashArray: '8 5', opacity: 0.9 }
        ).addTo(this.map!);
        this.mapLayers.push(this.routeLayer);
      }
    }
  }

  private makePopupHtml(d: DeliveryItem, type: 'pickup' | 'dropoff'): string {
    const addr   = type === 'pickup' ? d.pickupAddress : d.dropoffAddress;
    const colour = type === 'pickup' ? this.statusColour(d.status) : '#ef4444';
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
    const alreadySelected = this.selectedDeliveryId() === item.id;
    this.selectedDeliveryId.set(alreadySelected ? null : item.id);
    this.refreshMapMarkers();
    if (alreadySelected || !this.map) return;

    const pts: L.LatLngExpression[] = [];
    if (item.pickupLat  && item.pickupLng)  pts.push([item.pickupLat,  item.pickupLng]);
    if (item.dropoffLat && item.dropoffLng) pts.push([item.dropoffLat, item.dropoffLng]);
    if (pts.length === 2) {
      this.map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15, animate: true, duration: 0.8 });
    } else if (pts.length === 1) {
      this.map.flyTo(pts[0], 15, { duration: 0.8 });
    }
  }

  loadDashboardDeliveries() {
    const orgId = this.orgId();
    if (!orgId) return;
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

  destroyDashboardMap() {
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = null;
    if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; }
    if (this.map)        { this.map.remove();        this.map = null; }
    this.mapLayers = [];
    this.deliveryMarkers.clear();
  }

  constructor(
    private orgDashboardService: OrgDashboardService,
    private orgDeliveryService:  OrgDeliveryService,
    private shopService:         ShopService,
    private userService:         UserService,
    private toast:               ToastService,
    private deliveryUiService:   DeliveryUiService,
  ) {}

  openNewDelivery() { this.deliveryUiService.open(); }

  ngOnInit()        { this.loadDashboardStats(); this.loadDashboardDeliveries(); this.loadShops(); }
  ngAfterViewInit() { setTimeout(() => this.initDashboardMap(), 0); }
  ngOnDestroy()     { this.destroyDashboardMap(); }
}

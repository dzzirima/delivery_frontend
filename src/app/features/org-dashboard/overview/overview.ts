import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import { GooglePlacesDirective, PlaceResult } from '../../../core/directives/google-places.directive';
import { OrgDashboardService, OrgDashboardStats } from './overview.service';
import { OrgDeliveryService, DeliveryItem } from '../deliveries/deliveries.service';
import { ShopService, Shop } from '../shops/shops.service';
import { UserService } from '../../users/services/user.service';
import { ToastService } from '../../../core/toast.service';
import { DeliveryUiService } from '../deliveries/deliveries-ui.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DecimalPipe, GooglePlacesDirective],
  templateUrl: './overview.html',
})
export class Overview implements OnInit, AfterViewInit, OnDestroy {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  // ── Dashboard stats ─────────────────────────────────────────────────────────
  dashboardStats = signal<OrgDashboardStats | null>(null);
  statsLoading   = signal(false);

  loadDashboardStats() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.statsLoading.set(true);
    this.orgDashboardService.getStats(orgId).subscribe({
      next:  r => { this.dashboardStats.set(r.data); this.statsLoading.set(false); },
      error: () => { this.statsLoading.set(false); },
    });
  }

  // ── Dashboard map ────────────────────────────────────────────────────────────
  @ViewChild('dashboardMap') mapEl?: ElementRef;
  private map: L.Map | null = null;
  private mapLayers: L.Layer[] = [];
  private routeLayer: L.Polyline | null = null;
  private deliveryMarkers = new Map<string, { pickup?: L.Marker; dropoff?: L.Marker }>();

  dashboardDeliveries         = signal<DeliveryItem[]>([]);
  dashboardDeliveryLoading        = signal(false);
  selectedDeliveryId          = signal<string | null>(null);
  selectedDelivery           = computed(() => this.dashboardDeliveries().find(d => d.id === this.selectedDeliveryId()) ?? null);
  hoveredDeliveryId           = signal<string | null>(null);
  hoveredDelivery            = computed(() => this.dashboardDeliveries().find(d => d.id === this.hoveredDeliveryId()) ?? null);
  deliverySearchQuery         = signal('');
  filteredDeliveries          = computed(() => {
    const q = this.deliverySearchQuery().trim().toLowerCase();
    if (!q) return this.dashboardDeliveries();
    return this.dashboardDeliveries().filter(d =>
      (d.clientName ?? '').toLowerCase().includes(q) ||
      (d.pickupAddress ?? '').toLowerCase().includes(q) ||
      (d.dropoffAddress ?? '').toLowerCase().includes(q)
    );
  });

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

  closeEditDelivery() { this.editDeliveryModalError.set(''); this.editDeliveryModal.set(false); }

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
    this.orgDeliveryService.updateDelivery(orgId, item.id, body).subscribe({
      next: () => {
        this.editDeliverySaving.set(false);
        this.closeEditDelivery();
        this.loadDashboardDeliveries();
        this.toast.success('Success', 'Delivery updated.');
      },
      error: (e) => {
        this.editDeliverySaving.set(false);
        this.editDeliveryModalError.set(e?.error?.message ?? 'Failed to update delivery.');
      },
    });
  }

  onEditPickupSelected(p: PlaceResult) {
    this.editForm.pickupAddress = p.address;
  }

  onEditDropoffSelected(p: PlaceResult) {
    this.editForm.dropoffAddress = p.address;
  }

  // ── Shops (for map pins) ─────────────────────────────────────────────────────
  shops = signal<Shop[]>([]);

  loadShops() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopService.getAll(orgId).subscribe({
      next:  r => { this.shops.set(r.data ?? []); this.refreshMapMarkers(); },
      error: () => {},
    });
  }

  // ── Map helpers ──────────────────────────────────────────────────────────────
  statusColour(status: string): string {
    const map: Record<string, string> = {
      ASSIGNED: '#f59e0b', ACCEPTED: '#3b82f6', IN_TRANSIT: '#8b5cf6',
      DELIVERED: '#10b981', DECLINED: '#ef4444', PUBLISHED: '#f97316',
    };
    return map[status] ?? '#6b7280';
  }

  private makePin(colour: string, label: string, selected = false): L.DivIcon {
    const size = selected ? 20 : 14;
    const border = selected ? '3px solid white' : '2.5px solid white';
    const shadow = selected ? '0 0 0 3px ' + colour + '55, 0 2px 6px rgba(0,0,0,.4)' : '0 1px 4px rgba(0,0,0,.35)';
    return L.divIcon({
      className: '',
      html: `<div style="background:${colour};width:${size}px;height:${size}px;border-radius:50%;border:${border};box-shadow:${shadow};transition:all .2s" title="${label}"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  private shopPin(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div style="background:#4f46e5;width:18px;height:18px;border-radius:5px;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="white" viewBox="0 0 24 24"><path d="M3 9l1-6h16l1 6v2a2 2 0 01-2 2v8H5v-8a2 2 0 01-2-2V9z"/></svg>
      </div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

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
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);
    this.refreshMapMarkers();
  }

  refreshMapMarkers() {
    if (!this.map) return;
    this.mapLayers.forEach(l => l.remove());
    this.mapLayers = [];
    this.deliveryMarkers.clear();
    const selId = this.selectedDeliveryId();

    // Shop pins
    for (const shop of this.shops()) {
      if (shop.latitude && shop.longitude) {
        const m = L.marker([shop.latitude, shop.longitude], { icon: this.shopPin() })
          .bindPopup(`<b>${shop.name}</b><br><span style="color:#6b7280;font-size:12px">${shop.address}</span>`)
          .addTo(this.map!);
        this.mapLayers.push(m);
      }
    }

    // Dispatch pins
    for (const d of this.dashboardDeliveries()) {
      const colour = this.statusColour(d.status);
      const sel = d.id === selId;
      const entry: { pickup?: L.Marker; dropoff?: L.Marker } = {};

      if (d.pickupLat && d.pickupLng) {
        const m = L.marker([d.pickupLat, d.pickupLng], { icon: this.makePin(colour, `Pickup · ${d.clientName ?? d.status}`, sel), zIndexOffset: sel ? 1000 : 0 })
          .bindPopup(this.makePopupHtml(d, 'pickup'))
          .addTo(this.map!);
        if (sel) m.openPopup();
        entry.pickup = m;
        this.mapLayers.push(m);
      }
      if (d.dropoffLat && d.dropoffLng) {
        const m = L.marker([d.dropoffLat, d.dropoffLng], { icon: this.makePin('#ef4444', `Dropoff · ${d.clientName ?? d.status}`, sel), zIndexOffset: sel ? 1000 : 0 })
          .bindPopup(this.makePopupHtml(d, 'dropoff'))
          .addTo(this.map!);
        entry.dropoff = m;
        this.mapLayers.push(m);
      }
      this.deliveryMarkers.set(d.id, entry);
    }
  }

  private makePopupHtml(d: DeliveryItem, type: 'pickup' | 'dropoff'): string {
    const addr   = type === 'pickup' ? d.pickupAddress : d.dropoffAddress;
    const label  = type === 'pickup' ? 'Pickup' : 'Dropoff';
    const colour = this.statusColour(d.status);
    return `
      <div style="font-family:system-ui;min-width:160px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="width:8px;height:8px;border-radius:50%;background:${colour};display:inline-block;flex-shrink:0"></span>
          <b style="font-size:13px">${d.clientName ?? 'Dispatch'}</b>
        </div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:2px">${label}</div>
        <div style="font-size:12px;color:#111827">${addr}</div>
        ${d.driverName ? `<div style="font-size:11px;color:#4f46e5;margin-top:4px">Rider: ${d.driverName}</div>` : ''}
        <div style="font-size:11px;color:#6b7280;margin-top:2px;text-transform:capitalize">${d.status.toLowerCase().replace('_', ' ')} · $${d.price.toFixed(2)}</div>
      </div>`;
  }

  focusDelivery(item: DeliveryItem) {
    if (this.selectedDeliveryId() === item.id) return;
    this.selectedDeliveryId.set(item.id);
    if (!this.map) return;

    this.refreshMapMarkers();

    if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; }
    if (item.pickupLat && item.pickupLng && item.dropoffLat && item.dropoffLng) {
      this.routeLayer = L.polyline(
        [[item.pickupLat, item.pickupLng], [item.dropoffLat, item.dropoffLng]],
        { color: this.statusColour(item.status), weight: 3, dashArray: '8 6', opacity: 0.85 }
      ).addTo(this.map);
    }

    const pts: L.LatLngExpression[] = [];
    if (item.pickupLat  && item.pickupLng)  pts.push([item.pickupLat,  item.pickupLng]);
    if (item.dropoffLat && item.dropoffLng) pts.push([item.dropoffLat, item.dropoffLng]);
    if (pts.length === 2) {
      this.map.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 15, animate: true, duration: 1 });
    } else if (pts.length === 1) {
      this.map.flyTo(pts[0], 15, { duration: 1 });
    }
  }

  loadDashboardDeliveries() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.dashboardDeliveryLoading.set(true);
    this.orgDeliveryService.getBoard(orgId).subscribe({
      next: r => {
        const items = Array.isArray(r.data) ? r.data : [];
        if (items.length > 0) {
          const withCoords = items.map(d => ({
            ...d,
            pickupLat:  d.pickupLat  ?? this.randomCoord(-17.8292, 0.05),
            pickupLng:  d.pickupLng  ?? this.randomCoord(31.0522,  0.06),
            dropoffLat: d.dropoffLat ?? this.randomCoord(-17.8292, 0.05),
            dropoffLng: d.dropoffLng ?? this.randomCoord(31.0522,  0.06),
          }));
          this.dashboardDeliveries.set(withCoords);
          this.refreshMapMarkers();
        }
        this.dashboardDeliveryLoading.set(false);
      },
      error: () => this.dashboardDeliveryLoading.set(false),
    });
  }

  destroyDashboardMap() {
    if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; }
    if (this.map) { this.map.remove(); this.map = null; }
    this.mapLayers = [];
    this.deliveryMarkers.clear();
  }

  // TODO: replace with Google Places geocoding once API key is available
  randomCoord(base: number, spread: number): number {
    return parseFloat((base + (Math.random() * spread * 2 - spread)).toFixed(6));
  }

  // TODO: remove once backend returns real dispatch data
  private seedSampleMapData() {
    if (this.dashboardDeliveries().length === 0) {
      const now = new Date().toISOString();
      this.dashboardDeliveries.set([
        { id: 'd1', status: 'ASSIGNED',   dispatchStrategy: 'DIRECT_ASSIGN', pickupAddress: '74 Jason Moyo Ave',     pickupLat: -17.8292, pickupLng: 31.0522,  dropoffAddress: '22 Samora Machel Ave',  dropoffLat: -17.8340, dropoffLng: 31.0612, distanceKm: 1.8, estimatedDurationMinutes: 12, clientName: 'Alice Moyo',  driverId: null, driverName: 'Tendai M.', driverPhone: null, assignedByName: null, shopId: 's1', shopName: 'CBD Branch',       price: 5.50,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd2', status: 'IN_TRANSIT', dispatchStrategy: 'DIRECT_ASSIGN', pickupAddress: '12 King George Rd',     pickupLat: -17.8050, pickupLng: 31.0338,  dropoffAddress: '5 Harare Drive, Msasa', dropoffLat: -17.8460, dropoffLng: 31.1050, distanceKm: 5.2, estimatedDurationMinutes: 25, clientName: 'Bob Ncube',   driverId: null, driverName: 'Farai K.',  driverPhone: null, assignedByName: null, shopId: 's2', shopName: 'Avondale Branch',  price: 8.00,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd3', status: 'ACCEPTED',   dispatchStrategy: 'INTERNAL_BID',  pickupAddress: '4 Borrowdale Rd',       pickupLat: -17.7612, pickupLng: 31.0874,  dropoffAddress: '18 Fife Ave, Belgravia', dropoffLat: -17.8198, dropoffLng: 31.0480, distanceKm: 3.6, estimatedDurationMinutes: 18, clientName: 'Carol Dube',  driverId: null, driverName: null,       driverPhone: null, assignedByName: null, shopId: 's3', shopName: 'Borrowdale Branch', price: 6.50,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd4', status: 'DECLINED',   dispatchStrategy: 'DIRECT_ASSIGN', pickupAddress: '55 Union Ave, Harare',  pickupLat: -17.8315, pickupLng: 31.0480,  dropoffAddress: '30 Lomagundi Rd, Mbare', dropoffLat: -17.8680, dropoffLng: 30.9950, distanceKm: 7.1, estimatedDurationMinutes: 35, clientName: 'David Sibanda', driverId: null, driverName: 'Simba T.', driverPhone: null, assignedByName: null, shopId: 's1', shopName: 'CBD Branch',       price: 9.00,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd5', status: 'PUBLISHED',  dispatchStrategy: 'INTERNAL_BID',  pickupAddress: '8 Angwa St, Harare',    pickupLat: -17.8278, pickupLng: 31.0498,  dropoffAddress: '102 Churchill Ave, Highlands', dropoffLat: -17.7990, dropoffLng: 31.0720, distanceKm: 4.4, estimatedDurationMinutes: 22, clientName: 'Eve Mutasa',  driverId: null, driverName: null,       driverPhone: null, assignedByName: null, shopId: null, shopName: null,              price: 7.00,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
      ]);
    }
    this.refreshMapMarkers();
  }

  constructor(
    private orgDashboardService: OrgDashboardService,
    private orgDeliveryService:  OrgDeliveryService,
    private shopService:         ShopService,
    private userService:         UserService,
    private toast:               ToastService,
    private deliveryUiService:   DeliveryUiService,
  ) {}

  openNewDelivery() {
    this.deliveryUiService.open();
  }

  ngOnInit() {
    this.loadDashboardStats();
    this.loadDashboardDeliveries();
    this.loadShops();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initDashboardMap();
      this.seedSampleMapData();
    }, 0);
  }

  ngOnDestroy() {
    this.destroyDashboardMap();
  }
}

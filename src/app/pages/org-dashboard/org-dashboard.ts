import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { GooglePlacesDirective, PlaceResult } from '../../core/directives/google-places.directive';
import * as L from 'leaflet';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../features/users/services/user.service';
import { BikeService, Bike, BikeReq } from '../../features/fleet/services/bike.service';
import { ShopService, Shop, ShopReq } from '../../features/shops/services/shop.service';
import { ShopItemService, ShopItem, ShopItemReq } from '../../features/shop-items/services/shop-item.service';
import { ClientService, OrgClient, OrgClientReq } from '../../features/clients/services/client.service';
import { OrgDashboardService, OrgDashboardStats } from '../../features/org-dashboard/services/org-dashboard.service';
import { BikeOrgInviteService, BikeOrgInvite } from '../../features/bike-org-invites/services/bike-org-invite.service';
import { OrgDispatchService, DispatchItem, DispatchStats, OrgRider } from '../../features/org-dispatch/services/org-dispatch.service';
import { OrgMemberService, OrgMember } from '../../features/org-members/services/org-member.service';
import { DeliveryWebSocketService } from '../../core/delivery-websocket.service';
import { DeliveryRequestService, DriverBid } from '../../features/delivery/services/delivery-request.service';
import { ToastService } from '../../core/toast.service';

export type OrgPage =
  | 'dashboard'
  | 'dispatch'
  | 'fleet'
  | 'members'
  | 'clients'
  | 'items'
  | 'shops'
  | 'settings'
  | 'user-profile';

@Component({
  selector: 'app-org-dashboard',
  templateUrl: './org-dashboard.html',
  imports: [FormsModule, DatePipe, TitleCasePipe, CurrencyPipe, DecimalPipe, GooglePlacesDirective],
})
export class OrgDashboard implements OnInit, AfterViewInit, OnDestroy {
  collapsed  = signal(false);
  activePage = signal<OrgPage>('dashboard');

  get currentUser()  { return this.userService.profile; }
  get isOrgAdmin()   { return this.authService.getRole() === 'ORG_ADMIN'; }
  get isDispatcher() { return this.authService.getRole() === 'DISPATCHER'; }

  initials = computed(() => {
    const name = this.userService.profile()?.name ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  });

  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  // ── Dashboard stats ───────────────────────────────────────────────────────
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

  // ── Dashboard map ─────────────────────────────────────────────────────────
  @ViewChild('dashboardMap') mapEl?: ElementRef;
  private map: L.Map | null = null;
  private mapLayers: L.Layer[] = [];
  private routeLayer: L.Polyline | null = null;
  private dispatchMarkers = new Map<string, { pickup?: L.Marker; dropoff?: L.Marker }>();
  dashboardDispatches         = signal<DispatchItem[]>([]);
  dashboardDispLoading        = signal(false);
  selectedDispatchId          = signal<string | null>(null);
  selectedDispatch            = computed(() => this.dashboardDispatches().find(d => d.id === this.selectedDispatchId()) ?? null);
  hoveredDispatchId           = signal<string | null>(null);
  hoveredDispatch             = computed(() => this.dashboardDispatches().find(d => d.id === this.hoveredDispatchId()) ?? null);
  dispatchSearchQuery         = signal('');
  filteredDispatches          = computed(() => {
    const q = this.dispatchSearchQuery().trim().toLowerCase();
    if (!q) return this.dashboardDispatches();
    return this.dashboardDispatches().filter(d =>
      (d.clientName ?? '').toLowerCase().includes(q) ||
      (d.pickupAddress ?? '').toLowerCase().includes(q) ||
      (d.dropoffAddress ?? '').toLowerCase().includes(q)
    );
  });

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
    this.dispatchMarkers.clear();
    const selId = this.selectedDispatchId();

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
    for (const d of this.dashboardDispatches()) {
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
      this.dispatchMarkers.set(d.id, entry);
    }
  }

  private makePopupHtml(d: DispatchItem, type: 'pickup' | 'dropoff'): string {
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

  focusDispatch(item: DispatchItem) {
    if (this.selectedDispatchId() === item.id) return; // already selected
    this.selectedDispatchId.set(item.id);
    if (!this.map) return;

    // Re-render markers so selected ones are visually highlighted
    this.refreshMapMarkers();

    // Draw dashed route line between pickup and dropoff
    if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; }
    if (item.pickupLat && item.pickupLng && item.dropoffLat && item.dropoffLng) {
      this.routeLayer = L.polyline(
        [[item.pickupLat, item.pickupLng], [item.dropoffLat, item.dropoffLng]],
        { color: this.statusColour(item.status), weight: 3, dashArray: '8 6', opacity: 0.85 }
      ).addTo(this.map);
    }

    // Fit map to show both pickup and dropoff with padding
    const pts: L.LatLngExpression[] = [];
    if (item.pickupLat  && item.pickupLng)  pts.push([item.pickupLat,  item.pickupLng]);
    if (item.dropoffLat && item.dropoffLng) pts.push([item.dropoffLat, item.dropoffLng]);
    if (pts.length === 2) {
      this.map.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 15, animate: true, duration: 1 });
    } else if (pts.length === 1) {
      this.map.flyTo(pts[0], 15, { duration: 1 });
    }
  }

  loadDashboardDispatches() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.dashboardDispLoading.set(true);
    this.orgDispatchService.getBoard(orgId).subscribe({
      next: r => {
        const items = Array.isArray(r.data) ? r.data : [];
        if (items.length > 0) {
          // Fill in placeholder coordinates for items the backend hasn't geocoded yet
          const withCoords = items.map(d => ({
            ...d,
            pickupLat:  d.pickupLat  ?? this.randomCoord(-17.8292, 0.05),
            pickupLng:  d.pickupLng  ?? this.randomCoord(31.0522,  0.06),
            dropoffLat: d.dropoffLat ?? this.randomCoord(-17.8292, 0.05),
            dropoffLng: d.dropoffLng ?? this.randomCoord(31.0522,  0.06),
          }));
          this.dashboardDispatches.set(withCoords);
          this.refreshMapMarkers();
        }
        this.dashboardDispLoading.set(false);
      },
      error: () => this.dashboardDispLoading.set(false),
    });
  }

  destroyDashboardMap() {
    if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; }
    if (this.map) { this.map.remove(); this.map = null; }
    this.mapLayers = [];
    this.dispatchMarkers.clear();
  }

  // ── Flash ─────────────────────────────────────────────────────────────────
  flashError   = signal('');
  flashSuccess = signal('');

  // TODO: replace with Google Places geocoding once API key is available
  randomCoord(base: number, spread: number): number {
    return parseFloat((base + (Math.random() * spread * 2 - spread)).toFixed(6));
  }

  // TODO: replace with pricing algorithm
  randomPrice(): number {
    return parseFloat((3 + Math.random() * 7).toFixed(2));
  }

  private flash(type: 'ok' | 'err', msg: string) {
    if (type === 'ok') { this.flashSuccess.set(msg); setTimeout(() => this.flashSuccess.set(''), 3000); }
    else               { this.flashError.set(msg);   setTimeout(() => this.flashError.set(''),   4000); }
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  baseNavItems: { id: OrgPage; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard',  icon: 'home'       },
    { id: 'dispatch',  label: 'Dispatch',   icon: 'bolt'       },
    { id: 'fleet',     label: 'Fleet',      icon: 'truck'      },
    { id: 'members',   label: 'Members',    icon: 'user-plus'  },
    { id: 'clients',   label: 'Clients',    icon: 'users'      },
    { id: 'items',     label: 'Shop Items', icon: 'package'    },
    { id: 'shops',     label: 'Shops',      icon: 'store'      },
  ];

  get navItems() {
    return this.isOrgAdmin
      ? [...this.baseNavItems, { id: 'settings' as OrgPage, label: 'Settings', icon: 'cog' }]
      : this.baseNavItems;
  }

  // ── Bikes / Fleet ─────────────────────────────────────────────────────────
  bikes          = signal<Bike[]>([]);
  bikesLoading   = signal(false);
  bikeModal      = signal(false);
  bikeEditing    = signal<Bike | null>(null);
  bikeDeletingId = signal<string | null>(null);
  bikeModalError = signal('');
  bikeForm       = { make: '', model: '', licensePlate: '', vin: '' };

  // Invite flow
  invites            = signal<BikeOrgInvite[]>([]);
  invitesLoading     = signal(false);
  inviteModal        = signal(false);
  inviteSearch       = '';
  inviteResults      = signal<Bike[]>([]);
  inviteSearching    = signal(false);
  inviteSendingId    = signal<string | null>(null);
  inviteCancellingId = signal<string | null>(null);
  fleetTab           = signal<'bikes' | 'invites'>('bikes');

  loadBikes() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.bikesLoading.set(true);
    this.bikeService.getAll(orgId).subscribe({
      next:  r => { this.bikes.set(Array.isArray(r.data) ? r.data : []); this.bikesLoading.set(false); },
      error: () => { this.bikesLoading.set(false); this.flash('err', 'Failed to load fleet.'); },
    });
  }

  openBikeModal(bike?: Bike) {
    this.bikeEditing.set(bike ?? null);
    this.bikeForm = bike
      ? { make: bike.make, model: bike.model, licensePlate: bike.licensePlate, vin: bike.vin ?? '' }
      : { make: '', model: '', licensePlate: '', vin: '' };
    this.bikeModalError.set('');
    this.bikeModal.set(true);
  }

  closeBikeModal() { this.bikeModalError.set(''); this.bikeModal.set(false); }

  saveBike() {
    const orgId = this.orgId();
    if (!orgId) return;
    const editing = this.bikeEditing();
    this.bikesLoading.set(true);

    const obs = editing
      ? this.bikeService.update(editing.id, this.bikeForm)
      : this.bikeService.create({ ...this.bikeForm, organisationId: orgId });

    obs.subscribe({
      next: () => { this.closeBikeModal(); this.loadBikes(); this.flash('ok', editing ? 'Bike updated.' : 'Bike registered.'); },
      error: (e) => { this.bikesLoading.set(false); this.bikeModalError.set(e?.error?.message ?? 'Failed to save bike.'); },
    });
  }

  deleteBike(bikeId: string) {
    this.bikeService.delete(bikeId).subscribe({
      next:  () => { this.bikeDeletingId.set(null); this.loadBikes(); this.flash('ok', 'Bike removed.'); },
      error: (e) => { this.bikeDeletingId.set(null); this.flash('err', e?.error?.message ?? 'Failed to delete bike.'); },
    });
  }

  // ── Rider–bike pairing ────────────────────────────────────────────────────
  pairModal        = signal(false);
  pairBike         = signal<Bike | null>(null);
  pairRiderId      = signal('');
  pairSaving       = signal(false);
  pairModalError   = signal('');
  unpairingSaving  = signal<string | null>(null);

  openPairModal(bike: Bike) {
    this.pairBike.set(bike);
    this.pairRiderId.set(bike.assignedRiderId ?? '');
    this.pairModalError.set('');
    this.loadOrgRiders();
    this.pairModal.set(true);
  }
  closePairModal() { this.pairModalError.set(''); this.pairModal.set(false); }

  saveRiderPairing() {
    const bike = this.pairBike();
    const riderId = this.pairRiderId();
    if (!bike || !riderId) return;
    this.pairSaving.set(true);
    this.bikeService.assignRider(bike.id, riderId).subscribe({
      next: r => {
        this.bikes.update(list => list.map(b => b.id === bike.id ? r.data : b));
        this.pairSaving.set(false);
        this.closePairModal();
        this.flash('ok', 'Rider paired successfully.');
      },
      error: e => { this.pairSaving.set(false); this.pairModalError.set(e?.error?.message ?? 'Failed to pair rider.'); },
    });
  }

  unassignRider(bikeId: string) {
    this.unpairingSaving.set(bikeId);
    this.bikeService.unassignRider(bikeId).subscribe({
      next: r => {
        this.bikes.update(list => list.map(b => b.id === bikeId ? r.data : b));
        this.unpairingSaving.set(null);
        this.flash('ok', 'Rider unassigned.');
      },
      error: e => { this.unpairingSaving.set(null); this.flash('err', e?.error?.message ?? 'Failed to unassign rider.'); },
    });
  }

  loadInvites() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.invitesLoading.set(true);
    this.bikeOrgInviteService.list(orgId).subscribe({
      next:  r => { this.invites.set(Array.isArray(r.data) ? r.data : []); this.invitesLoading.set(false); },
      error: () => { this.invitesLoading.set(false); this.flash('err', 'Failed to load invites.'); },
    });
  }

  openInviteModal() {
    this.inviteSearch = '';
    this.inviteResults.set([]);
    this.inviteModal.set(true);
  }
  closeInviteModal() { this.inviteModal.set(false); }

  searchBikesForInvite() {
    if (!this.inviteSearch.trim()) return;
    this.inviteSearching.set(true);
    this.bikeService.searchGlobal(this.inviteSearch).subscribe({
      next:  r => { this.inviteResults.set(Array.isArray(r.data) ? r.data : []); this.inviteSearching.set(false); },
      error: () => { this.inviteSearching.set(false); this.flash('err', 'Search failed.'); },
    });
  }

  sendInvite(bikeId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.inviteSendingId.set(bikeId);
    this.bikeOrgInviteService.send(orgId, bikeId).subscribe({
      next:  () => { this.inviteSendingId.set(null); this.closeInviteModal(); this.loadInvites(); this.fleetTab.set('invites'); this.flash('ok', 'Invite sent to bike owner.'); },
      error: (e) => { this.inviteSendingId.set(null); this.flash('err', e?.error?.message ?? 'Failed to send invite.'); },
    });
  }

  cancelInvite(inviteId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.inviteCancellingId.set(inviteId);
    this.bikeOrgInviteService.cancel(orgId, inviteId).subscribe({
      next:  () => { this.inviteCancellingId.set(null); this.loadInvites(); this.flash('ok', 'Invite cancelled.'); },
      error: (e) => { this.inviteCancellingId.set(null); this.flash('err', e?.error?.message ?? 'Failed to cancel.'); },
    });
  }

  // ── Shops ─────────────────────────────────────────────────────────────────
  shops          = signal<Shop[]>([]);
  shopsLoading   = signal(false);
  shopModal      = signal(false);
  shopEditing    = signal<Shop | null>(null);
  shopDeletingId = signal<string | null>(null);
  shopModalError = signal('');
  shopForm       = { name: '', address: '', phone: '', latitude: null as number | null, longitude: null as number | null };

  loadShops() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopsLoading.set(true);
    this.shopService.getAll(orgId).subscribe({
      next:  r => {
        this.shops.set(r.data ?? []);
        this.shopsLoading.set(false);
        if (this.activePage() === 'dashboard') this.refreshMapMarkers();
      },
      error: () => { this.shopsLoading.set(false); this.flash('err', 'Failed to load shops.'); },
    });
  }

  openShopModal(shop?: Shop) {
    this.shopEditing.set(shop ?? null);
    this.shopForm = shop
      ? { name: shop.name, address: shop.address ?? '', phone: shop.phone ?? '', latitude: shop.latitude ?? null, longitude: shop.longitude ?? null }
      : { name: '', address: '', phone: '', latitude: null, longitude: null };
    this.shopModalError.set('');
    this.shopModal.set(true);
  }

  closeShopModal() { this.shopModalError.set(''); this.shopModal.set(false); }

  saveShop() {
    const orgId = this.orgId();
    if (!orgId) return;
    const editing = this.shopEditing();
    this.shopsLoading.set(true);

    const req: ShopReq = { name: this.shopForm.name, address: this.shopForm.address || undefined, phone: this.shopForm.phone || undefined, latitude: this.shopForm.latitude ?? undefined, longitude: this.shopForm.longitude ?? undefined };
    const obs = editing
      ? this.shopService.update(orgId, editing.id, req)
      : this.shopService.create(orgId, req);

    obs.subscribe({
      next: () => { this.closeShopModal(); this.loadShops(); this.flash('ok', editing ? 'Shop updated.' : 'Shop created.'); },
      error: (e) => { this.shopsLoading.set(false); this.shopModalError.set(e?.error?.message ?? 'Failed to save shop.'); },
    });
  }

  deleteShop(shopId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopService.delete(orgId, shopId).subscribe({
      next:  () => { this.shopDeletingId.set(null); this.loadShops(); this.flash('ok', 'Shop deleted.'); },
      error: (e) => { this.shopDeletingId.set(null); this.flash('err', e?.error?.message ?? 'Failed to delete shop.'); },
    });
  }

  // ── Shop Items ────────────────────────────────────────────────────────────
  shopItems        = signal<ShopItem[]>([]);
  itemsLoading     = signal(false);
  itemModal        = signal(false);
  itemEditing      = signal<ShopItem | null>(null);
  itemDeletingId   = signal<string | null>(null);
  itemModalError   = signal('');
  itemForm         = { shopId: '', name: '', description: '', sku: '', unit: '' };

  loadItems() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.itemsLoading.set(true);
    // Load shops in parallel so the form dropdown is populated
    if (this.shops().length === 0) this.loadShops();
    this.shopItemService.getAllByOrg(orgId).subscribe({
      next:  r => { this.shopItems.set(r.data ?? []); this.itemsLoading.set(false); },
      error: () => { this.itemsLoading.set(false); this.flash('err', 'Failed to load items.'); },
    });
  }

  openItemModal(item?: ShopItem) {
    this.itemEditing.set(item ?? null);
    this.itemForm = item
      ? { shopId: item.shopId, name: item.name, description: item.description ?? '', sku: item.sku ?? '', unit: item.unit ?? '' }
      : { shopId: this.shops()[0]?.id ?? '', name: '', description: '', sku: '', unit: '' };
    this.itemModalError.set('');
    this.itemModal.set(true);
  }

  closeItemModal() { this.itemModalError.set(''); this.itemModal.set(false); }

  saveItem() {
    const orgId = this.orgId();
    if (!orgId || !this.itemForm.shopId) { this.itemModalError.set('Please select a shop.'); return; }
    const editing = this.itemEditing();
    this.itemsLoading.set(true);

    const req: ShopItemReq = {
      name:        this.itemForm.name,
      description: this.itemForm.description || undefined,
      sku:         this.itemForm.sku         || undefined,
      unit:        this.itemForm.unit        || undefined,
    };

    const obs = editing
      ? this.shopItemService.update(orgId, this.itemForm.shopId, editing.id, req)
      : this.shopItemService.create(orgId, this.itemForm.shopId, req);

    obs.subscribe({
      next: () => { this.closeItemModal(); this.loadItems(); this.flash('ok', editing ? 'Item updated.' : 'Item added.'); },
      error: (e) => { this.itemsLoading.set(false); this.itemModalError.set(e?.error?.message ?? 'Failed to save item.'); },
    });
  }

  deleteItem(item: ShopItem) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopItemService.delete(orgId, item.shopId, item.id).subscribe({
      next:  () => { this.itemDeletingId.set(null); this.loadItems(); this.flash('ok', 'Item deleted.'); },
      error: (e) => { this.itemDeletingId.set(null); this.flash('err', e?.error?.message ?? 'Failed to delete item.'); },
    });
  }

  // ── Clients ───────────────────────────────────────────────────────────────
  clients          = signal<OrgClient[]>([]);
  clientsLoading   = signal(false);
  clientModal      = signal(false);
  clientEditing    = signal<OrgClient | null>(null);
  clientDeletingId = signal<string | null>(null);
  clientModalError = signal('');
  clientSearch     = '';
  clientForm       = { name: '', phone: '', email: '', address: '', latitude: null as number | null, longitude: null as number | null, notes: '' };

  loadClients() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.clientsLoading.set(true);
    this.clientService.getAll(orgId, this.clientSearch).subscribe({
      next:  r => { this.clients.set(r.data ?? []); this.clientsLoading.set(false); },
      error: () => { this.clientsLoading.set(false); this.flash('err', 'Failed to load clients.'); },
    });
  }

  openClientModal(client?: OrgClient) {
    this.clientEditing.set(client ?? null);
    this.clientForm = client
      ? { name: client.name, phone: client.phone ?? '', email: client.email ?? '', address: client.address ?? '', latitude: client.latitude ?? null, longitude: client.longitude ?? null, notes: client.notes ?? '' }
      : { name: '', phone: '', email: '', address: '', latitude: null, longitude: null, notes: '' };
    this.clientModalError.set('');
    this.clientModal.set(true);
  }

  closeClientModal() { this.clientModalError.set(''); this.clientModal.set(false); }

  saveClient() {
    const orgId = this.orgId();
    if (!orgId) return;
    const editing = this.clientEditing();
    this.clientsLoading.set(true);

    const req: OrgClientReq = {
      name:      this.clientForm.name,
      phone:     this.clientForm.phone     || undefined,
      email:     this.clientForm.email     || undefined,
      address:   this.clientForm.address   || undefined,
      latitude:  this.clientForm.latitude  ?? undefined,
      longitude: this.clientForm.longitude ?? undefined,
      notes:     this.clientForm.notes     || undefined,
    };

    const obs = editing
      ? this.clientService.update(orgId, editing.id, req)
      : this.clientService.create(orgId, req);

    obs.subscribe({
      next: () => { this.closeClientModal(); this.loadClients(); this.flash('ok', editing ? 'Client updated.' : 'Client added.'); },
      error: (e) => {
        this.clientsLoading.set(false);
        this.clientModalError.set(e?.error?.message ?? 'Failed to save client.');
      },
    });
  }

  deleteClient(clientId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.clientService.delete(orgId, clientId).subscribe({
      next:  () => { this.clientDeletingId.set(null); this.loadClients(); this.flash('ok', 'Client removed.'); },
      error: (e) => { this.clientDeletingId.set(null); this.flash('err', e?.error?.message ?? 'Failed to delete client.'); },
    });
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  dispatches        = signal<DispatchItem[]>([]);
  dispatchStats     = signal<DispatchStats | null>(null);
  dispatchLoading   = signal(false);
  dispatchFilter    = signal('');
  dispatchTotal     = signal(0);
  dispatchActioning = signal<string | null>(null);

  // ── Edit dispatch modal ──
  editDispatchModal      = signal(false);
  editDispatchItem       = signal<DispatchItem | null>(null);
  editDispatchSaving     = signal(false);
  editDispatchModalError = signal('');
  editForm = {
    pickupAddress: '', dropoffAddress: '',
    description: '', price: null as number | null,
    paymentMethod: 'CASH', status: '',
  };

  openEditDispatch(item: DispatchItem) {
    this.editDispatchItem.set(item);
    this.editForm = {
      pickupAddress:  item.pickupAddress  ?? '',
      dropoffAddress: item.dropoffAddress ?? '',
      description:    item.description    ?? '',
      price:          item.price          ?? null,
      paymentMethod:  item.paymentStatus  ?? 'CASH',
      status:         item.status,
    };
    this.editDispatchModalError.set('');
    this.editDispatchModal.set(true);
  }

  closeEditDispatch() { this.editDispatchModalError.set(''); this.editDispatchModal.set(false); }

  saveEditDispatch() {
    const orgId = this.orgId();
    const item  = this.editDispatchItem();
    if (!orgId || !item) return;
    this.editDispatchSaving.set(true);
    const body: Record<string, unknown> = {
      pickupAddress:  this.editForm.pickupAddress,
      dropoffAddress: this.editForm.dropoffAddress,
      price:          this.editForm.price ?? 0,
      status:         this.editForm.status,
    };
    if (this.editForm.description) body['description'] = this.editForm.description;
    this.orgDispatchService.updateDispatch(orgId, item.id, body).subscribe({
      next: () => {
        this.editDispatchSaving.set(false);
        this.closeEditDispatch();
        this.loadDashboardDispatches();
        this.flash('ok', 'Dispatch updated.');
      },
      error: (e) => {
        this.editDispatchSaving.set(false);
        this.editDispatchModalError.set(e?.error?.message ?? 'Failed to update dispatch.');
      },
    });
  }

  createDispatchModal  = signal(false);
  dispatchTab          = signal<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  dispatchSaving       = signal(false);
  dispatchModalError   = signal('');
  dispatchForm = {
    dispatchStrategy: 'DIRECT_ASSIGN',
    pickupAddress: '', pickupLat: null as number | null, pickupLng: null as number | null,
    dropoffAddress: '', dropoffLat: null as number | null, dropoffLng: null as number | null,
    description: '', budget: null as number | null,
    driverId: '', orgClientId: '', paymentMethod: 'CASH',
    shopId: '', packageSizeCategory: 'MEDIUM',
  };

  // ── Public dispatch bidding flow ──────────────────────────────────────────
  publicDispatchState   = signal<'form' | 'awaiting'>('form');
  publicRequestId       = signal<string | null>(null);
  publicBids            = signal<DriverBid[]>([]);
  publicAcceptingId     = signal<string | null>(null);
  wsConnected           = computed(() => this.deliveryWsService.connected());

  // Reprice
  repriceValue          = signal(0);
  repriceLoading        = signal(false);
  repriceCooldown       = signal(0);
  private repriceCooldownTimer: ReturnType<typeof setInterval> | null = null;

  // Cancel reason
  cancelReasonOpen      = signal(false);
  cancelReasonSelected  = signal<string | null>(null);
  cancelReasonCustom    = '';
  cancelLoading         = signal(false);
  readonly cancelReasonPresets = ['Changed my mind', 'Price too high', 'Wrong address', 'Emergency'];

  private wsSubscription: Subscription | null = null;

  // Client search inside dispatch form
  dispatchClientSearch   = signal('');
  dispatchClientFocused  = signal(false);
  dispatchQuickAdd        = signal(false);
  dispatchQuickForm       = { name: '', phone: '', address: '', latitude: null as number | null, longitude: null as number | null };
  dispatchQuickSaving     = signal(false);
  quickClientModalError   = signal('');
  dispatchSelectedClient       = signal<OrgClient | null>(null);
  dispatchShopPickerOpen       = signal(false);
  dispatchShopPickerDropoffOpen = signal(false);

  // Item picker inside dispatch form
  dispatchItemPickerOpen  = signal(false);
  dispatchItemSearch      = signal('');
  dispatchItemsLoading    = signal(false);
  dispatchSelectedItems   = signal<{ item: ShopItem; qty: number }[]>([]);
  dispatchShopId          = signal('');

  dispatchShopItems = computed(() => {
    const q = this.dispatchItemSearch().toLowerCase().trim();
    return q
      ? this.shopItems().filter(i => i.name.toLowerCase().includes(q))
      : this.shopItems();
  });

  loadDispatchItems() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.dispatchItemsLoading.set(true);
    this.shopItemService.getAllByOrg(orgId).subscribe({
      next:  r => { this.shopItems.set(r.data ?? []); this.dispatchItemsLoading.set(false); },
      error: () => { this.dispatchItemsLoading.set(false); },
    });
  }

  addDispatchItem(item: ShopItem) {
    const existing = this.dispatchSelectedItems().find(s => s.item.id === item.id);
    if (existing) {
      this.dispatchSelectedItems.update(list =>
        list.map(s => s.item.id === item.id ? { ...s, qty: s.qty + 1 } : s)
      );
    } else {
      this.dispatchSelectedItems.update(list => [...list, { item, qty: 1 }]);
    }
    this.syncDispatchDescription();
  }

  removeDispatchItem(itemId: string) {
    this.dispatchSelectedItems.update(list => list.filter(s => s.item.id !== itemId));
    this.syncDispatchDescription();
  }

  updateDispatchItemQty(itemId: string, qty: number) {
    if (qty < 1) { this.removeDispatchItem(itemId); return; }
    this.dispatchSelectedItems.update(list =>
      list.map(s => s.item.id === itemId ? { ...s, qty } : s)
    );
    this.syncDispatchDescription();
  }

  readonly totalQty = (acc: number, s: { qty: number }) => acc + s.qty;
  selectedQty(itemId: string): number {
    return this.dispatchSelectedItems().find(s => s.item.id === itemId)?.qty ?? 0;
  }

  syncDispatchDescription() {
    // Deduplicate by item ID (merge any duplicate entries that shouldn't exist)
    const merged = new Map<string, { item: ShopItem; qty: number }>();
    for (const s of this.dispatchSelectedItems()) {
      const existing = merged.get(s.item.id);
      merged.set(s.item.id, { item: s.item, qty: (existing?.qty ?? 0) + s.qty });
    }
    const lines = Array.from(merged.values()).map(s => {
      let label = `${s.qty}x ${s.item.name}`;
      if (s.item.sku)  label += ` [${s.item.sku}]`;
      if (s.item.unit) label += ` (${s.item.unit})`;
      return label;
    });
    this.dispatchForm.description = lines.join(', ');
  }

  filteredDispatchClients = computed(() => {
    const q = this.dispatchClientSearch().toLowerCase().trim();
    if (!q) return this.clients();
    return this.clients().filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)
    );
  });

  selectDispatchClient(c: OrgClient) {
    this.dispatchForm.orgClientId = c.id;
    this.dispatchClientSearch.set(c.name);
    this.dispatchClientFocused.set(false);
    this.dispatchQuickAdd.set(false);
    this.dispatchSelectedClient.set(c);
  }

  openDispatchQuickAdd() {
    this.dispatchQuickForm = { name: this.dispatchClientSearch(), phone: '', address: '', latitude: null, longitude: null };
    this.quickClientModalError.set('');
    this.dispatchQuickAdd.set(true);
    this.dispatchClientFocused.set(false);
  }

  closeDispatchQuickAdd() {
    this.quickClientModalError.set('');
    this.dispatchQuickAdd.set(false);
  }

  saveQuickDispatchClient() {
    const orgId = this.orgId();
    if (!orgId || !this.dispatchQuickForm.name.trim()) return;
    this.dispatchQuickSaving.set(true);
    this.clientService.create(orgId, {
      name:      this.dispatchQuickForm.name.trim(),
      phone:     this.dispatchQuickForm.phone     || undefined,
      address:   this.dispatchQuickForm.address   || undefined,
      latitude:  this.dispatchQuickForm.latitude  ?? undefined,
      longitude: this.dispatchQuickForm.longitude ?? undefined,
    }).subscribe({
      next: r => {
        const c = r.data;
        this.clients.update(list => [...list, c]);
        this.dispatchForm.orgClientId = c.id;
        this.dispatchClientSearch.set(c.name);
        this.dispatchSelectedClient.set(c);
        this.closeDispatchQuickAdd();
        this.dispatchQuickSaving.set(false);
        this.dispatchQuickForm = { name: '', phone: '', address: '', latitude: null, longitude: null };
        this.flash('ok', 'Client added.');
      },
      error: e => {
        this.dispatchQuickSaving.set(false);
        this.quickClientModalError.set(e?.error?.message ?? 'Failed to add client.');
      },
    });
  }

  // ── Google Places handlers ────────────────────────────────────────────────
  onPickupPlaceSelected(p: PlaceResult) {
    this.dispatchForm.pickupAddress = p.address;
    this.dispatchForm.pickupLat     = p.lat;
    this.dispatchForm.pickupLng     = p.lng;
  }

  onDropoffPlaceSelected(p: PlaceResult) {
    this.dispatchForm.dropoffAddress = p.address;
    this.dispatchForm.dropoffLat     = p.lat;
    this.dispatchForm.dropoffLng     = p.lng;
  }

  onEditPickupSelected(p: PlaceResult) {
    this.editForm.pickupAddress = p.address;
  }

  onEditDropoffSelected(p: PlaceResult) {
    this.editForm.dropoffAddress = p.address;
  }

  onShopAddressSelected(p: PlaceResult) {
    this.shopForm.address   = p.address;
    this.shopForm.latitude  = p.lat;
    this.shopForm.longitude = p.lng;
  }

  onClientAddressSelected(p: PlaceResult) {
    this.clientForm.address   = p.address;
    this.clientForm.latitude  = p.lat;
    this.clientForm.longitude = p.lng;
  }

  onQuickClientAddressSelected(p: PlaceResult) {
    this.dispatchQuickForm.address   = p.address;
    this.dispatchQuickForm.latitude  = p.lat;
    this.dispatchQuickForm.longitude = p.lng;
  }

  orgRiders          = signal<OrgRider[]>([]);
  ridersLoading      = signal(false);
  dispatchDetailItem = signal<DispatchItem | null>(null);
  reassignModal      = signal(false);
  reassignDriverId   = '';

  refreshOrgRiders() {
    this.orgRiders.set([]); // clear cache so next open re-fetches
    this.loadOrgRiders();
  }

  loadOrgRiders() {
    const orgId = this.orgId();
    if (!orgId || this.orgRiders().length > 0) return; // cached until manually cleared
    this.ridersLoading.set(true);
    this.orgDispatchService.getRiders(orgId).subscribe({
      next:  r => { this.orgRiders.set(Array.isArray(r.data) ? r.data : []); this.ridersLoading.set(false); },
      error: () => { this.ridersLoading.set(false); },
    });
  }

  loadDispatch() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.dispatchLoading.set(true);
    const status = this.dispatchFilter() || undefined;
    this.orgDispatchService.getBoard(orgId, status).subscribe({
      next: r => {
        this.dispatches.set(Array.isArray(r.data) ? r.data : []);
        this.dispatchTotal.set(r.length ?? 0);
        this.dispatchLoading.set(false);
      },
      error: () => { this.dispatchLoading.set(false); this.flash('err', 'Failed to load dispatches.'); },
    });
    this.orgDispatchService.getStats(orgId).subscribe({
      next: r => this.dispatchStats.set(r.data),
      error: () => {},
    });
  }

  openCreateDispatch() {
    this.dispatchTab.set('PUBLIC');
    this.dispatchForm = {
      dispatchStrategy: 'DIRECT_ASSIGN',
      pickupAddress: '', pickupLat: null, pickupLng: null,
      dropoffAddress: '', dropoffLat: null, dropoffLng: null,
      description: '', budget: this.randomPrice(),
      driverId: '', orgClientId: '', paymentMethod: 'CASH',
      shopId: '', packageSizeCategory: 'MEDIUM',
    };
    this.dispatchClientSearch.set('');
    this.dispatchClientFocused.set(false);
    this.dispatchQuickAdd.set(false);
    this.dispatchQuickForm = { name: '', phone: '', address: '', latitude: null, longitude: null };
    this.dispatchSelectedClient.set(null);
    this.dispatchShopPickerOpen.set(false);
    this.dispatchShopPickerDropoffOpen.set(false);
    this.dispatchItemPickerOpen.set(false);
    this.dispatchItemSearch.set('');
    this.dispatchSelectedItems.set([]);
    this.dispatchShopId.set('');
    this.dispatchModalError.set('');
    // Reset bidding state
    this.publicDispatchState.set('form');
    this.publicRequestId.set(null);
    this.publicBids.set([]);
    this.publicAcceptingId.set(null);
    this.cancelReasonOpen.set(false);
    this.cancelReasonSelected.set(null);
    this.cancelReasonCustom = '';
    this.repriceValue.set(0);
    this.repriceCooldown.set(0);
    this.loadOrgRiders();
    if (this.clients().length === 0) this.loadClients();
    if (this.shops().length === 0) this.loadShops();
    this.loadDispatchItems();
    this.createDispatchModal.set(true);
  }

  /** Close only from the form state (backdrop click / Cancel button in form). */
  closeCreateDispatch() {
    if (this.publicDispatchState() === 'awaiting') return;
    this.dispatchModalError.set('');
    this.createDispatchModal.set(false);
  }

  /** Tear down bid subscription, clear all bidding state, and close the modal. */
  private finalCloseModal() {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
    // Do NOT disconnect the WS — it stays alive for the full dashboard session.
    if (this.repriceCooldownTimer) { clearInterval(this.repriceCooldownTimer); this.repriceCooldownTimer = null; }
    this.toastService.dismissAllBids();
    this.dispatchModalError.set('');
    this.publicDispatchState.set('form');
    this.publicRequestId.set(null);
    this.publicBids.set([]);
    this.publicAcceptingId.set(null);
    this.cancelReasonOpen.set(false);
    this.createDispatchModal.set(false);
  }

  switchDispatchTab(tab: 'PUBLIC' | 'INTERNAL') {
    this.dispatchTab.set(tab);
    this.dispatchModalError.set('');
    this.dispatchForm = {
      dispatchStrategy: tab === 'PUBLIC' ? 'PUBLIC_BID' : 'INTERNAL_BID',
      pickupAddress: '', pickupLat: null, pickupLng: null,
      dropoffAddress: '', dropoffLat: null, dropoffLng: null,
      description: '', budget: this.randomPrice(),
      driverId: '', orgClientId: '', paymentMethod: 'CASH',
      shopId: '', packageSizeCategory: 'MEDIUM',
    };
    this.dispatchClientSearch.set('');
    this.dispatchClientFocused.set(false);
    this.dispatchQuickAdd.set(false);
    this.dispatchQuickForm = { name: '', phone: '', address: '', latitude: null, longitude: null };
    this.dispatchSelectedClient.set(null);
    this.dispatchShopPickerOpen.set(false);
    this.dispatchShopPickerDropoffOpen.set(false);
    this.dispatchItemPickerOpen.set(false);
    this.dispatchItemSearch.set('');
    this.dispatchSelectedItems.set([]);
    this.dispatchShopId.set('');
  }

  saveDispatch() {
    if (this.dispatchTab() === 'PUBLIC') {
      this.savePublicDispatch();
    } else {
      this.saveInternalDispatch();
    }
  }

  // ── Public dispatch — hits /delivery/request (same flow as mobile) ────────

  savePublicDispatch() {
    const f = this.dispatchForm;
    this.dispatchSaving.set(true);
    this.dispatchModalError.set('');

    const body: Record<string, unknown> = {
      pickupAddress:       f.pickupAddress,
      dropoffAddress:      f.dropoffAddress,
      price:               f.budget ?? 0,
      priority:            'NORMAL',
      packageSizeCategory: f.packageSizeCategory || 'MEDIUM',
    };
    if (f.pickupLat  != null) body['pickupLat']  = f.pickupLat;
    if (f.pickupLng  != null) body['pickupLng']  = f.pickupLng;
    if (f.dropoffLat != null) body['dropoffLat'] = f.dropoffLat;
    if (f.dropoffLng != null) body['dropoffLng'] = f.dropoffLng;
    if (f.description)        body['description'] = f.description;
    if (f.orgClientId)        body['orgClientId'] = f.orgClientId;

    this.deliveryRequestService.createRequest(body).subscribe({
      next: r => {
        const requestId = r.data?.requestId;
        if (!requestId) {
          this.dispatchSaving.set(false);
          this.dispatchModalError.set('No request ID returned from server.');
          return;
        }
        this.publicRequestId.set(requestId);
        this.repriceValue.set(f.budget ?? 0);
        this.publicBids.set([]);
        this.dispatchSaving.set(false);

        // Subscribe to driver bid events (WS already connected at ngOnInit)
        this.wsSubscription?.unsubscribe();
        this.wsSubscription = this.deliveryWsService.events$.subscribe(evt => {
          if (evt.type === 'driverOfferEvent') {
            this.onBidReceived(evt.data as unknown as DriverBid);
          } else if (evt.type === 'requestCancelledEvent') {
            this.finalCloseModal();
            this.toastService.warning('Request Cancelled', 'Your delivery request has been cancelled.');
          } else if (evt.type === 'requestExpiredEvent') {
            this.finalCloseModal();
            this.toastService.warning('Request Expired', 'No drivers responded in time.');
          }
        });

        this.publicDispatchState.set('awaiting');
        this.startRepriceCooldown();
      },
      error: e => {
        this.dispatchSaving.set(false);
        this.dispatchModalError.set(e?.error?.message ?? 'Failed to create request.');
      },
    });
  }

  onBidReceived(data: DriverBid) {
    if (this.publicDispatchState() !== 'awaiting') return;
    // Accumulate (deduplicate by driverId — driver may re-bid)
    this.publicBids.update(list => [data, ...list.filter(b => b.driverId !== data.driverId)]);
    // Show toast with Accept / Decline
    this.toastService.bid(data, (bid, toastId) => {
      this.toastService.dismiss(toastId);
      this.acceptBid(bid);
    });
  }

  acceptBid(bid: DriverBid) {
    const requestId = this.publicRequestId();
    if (!requestId || this.publicAcceptingId()) return;
    this.publicAcceptingId.set(bid.driverId);
    this.toastService.dismissAllBids();

    this.deliveryRequestService.acceptBid(requestId, bid.driverId).subscribe({
      next: () => {
        this.finalCloseModal();
        this.loadDispatch();
        this.toastService.success('Bid Accepted', `${bid.driverName} is on the way.`);
      },
      error: e => {
        this.publicAcceptingId.set(null);
        this.toastService.error('Failed to Accept Bid', e?.error?.message ?? 'Something went wrong.');
      },
    });
  }

  // ── Reprice ───────────────────────────────────────────────────────────────

  adjustReprice(delta: number) {
    const updated = Math.max(0.5, parseFloat((this.repriceValue() + delta).toFixed(2)));
    this.repriceValue.set(updated);
  }

  submitReprice() {
    const requestId = this.publicRequestId();
    if (!requestId || this.repriceLoading() || this.repriceCooldown() > 0) return;
    this.repriceLoading.set(true);

    this.deliveryRequestService.repriceRequest(requestId, this.repriceValue()).subscribe({
      next: () => {
        this.repriceLoading.set(false);
        this.startRepriceCooldown();
        this.flash('ok', 'Price updated — drivers notified.');
      },
      error: e => {
        this.repriceLoading.set(false);
        if (e?.status === 404) {
          this.flash('err', 'Request expired — no drivers responded in time.');
          this.finalCloseModal();
        } else {
          this.flash('err', e?.error?.message ?? 'Failed to update price.');
        }
      },
    });
  }

  startRepriceCooldown() {
    if (this.repriceCooldownTimer) clearInterval(this.repriceCooldownTimer);
    this.repriceCooldown.set(30);
    this.repriceCooldownTimer = setInterval(() => {
      this.repriceCooldown.update(v => {
        if (v <= 1) { clearInterval(this.repriceCooldownTimer!); this.repriceCooldownTimer = null; return 0; }
        return v - 1;
      });
    }, 1000);
  }

  // ── Cancel flow ───────────────────────────────────────────────────────────

  startCancelFlow() {
    this.cancelReasonSelected.set(null);
    this.cancelReasonCustom = '';
    this.cancelReasonOpen.set(true);
  }

  toggleCancelReason(reason: string) {
    this.cancelReasonSelected.update(v => v === reason ? null : reason);
    if (this.cancelReasonSelected()) this.cancelReasonCustom = '';
  }

  confirmCancel(skipReason = false) {
    const reason = skipReason ? undefined
      : (this.cancelReasonCustom.trim() || this.cancelReasonSelected() || undefined);
    const requestId = this.publicRequestId();
    if (!requestId) { this.finalCloseModal(); return; }
    this.cancelLoading.set(true);

    this.deliveryRequestService.cancelRequest(requestId, reason).subscribe({
      next:  () => { this.cancelLoading.set(false); this.finalCloseModal(); this.toastService.warning('Request Cancelled', 'Your delivery request has been cancelled.'); },
      error: () => { this.cancelLoading.set(false); this.finalCloseModal(); },
    });
  }

  // ── Internal dispatch — hits /org/{id}/delivery (unchanged logic) ─────────

  saveInternalDispatch() {
    const orgId = this.orgId();
    if (!orgId) return;
    const f = this.dispatchForm;
    this.dispatchSaving.set(true);
    const body: Record<string, unknown> = {
      dispatchStrategy: f.dispatchStrategy,
      pickupAddress:  f.pickupAddress,
      pickupLat:      f.pickupLat  ?? 0,
      pickupLng:      f.pickupLng  ?? 0,
      dropoffAddress: f.dropoffAddress,
      dropoffLat:     f.dropoffLat ?? 0,
      dropoffLng:     f.dropoffLng ?? 0,
      budget:         f.budget     ?? 0,
      paymentMethod:  f.paymentMethod || 'CASH',
    };
    if (f.description)                                           body['description'] = f.description;
    if (f.dispatchStrategy === 'DIRECT_ASSIGN' && f.driverId)   body['driverId']     = f.driverId;
    if (f.orgClientId)                                           body['orgClientId']  = f.orgClientId;

    this.orgDispatchService.createDispatch(orgId, body).subscribe({
      next: () => { this.dispatchSaving.set(false); this.closeCreateDispatch(); this.loadDispatch(); this.flash('ok', 'Dispatch created.'); },
      error: e => { this.dispatchSaving.set(false); this.dispatchModalError.set(e?.error?.message ?? 'Failed to create dispatch.'); },
    });
  }

  cancelDispatch(id: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.dispatchActioning.set(id);
    this.orgDispatchService.cancel(orgId, id).subscribe({
      next: () => { this.dispatchActioning.set(null); this.loadDispatch(); this.flash('ok', 'Dispatch cancelled.'); },
      error: (e) => { this.dispatchActioning.set(null); this.flash('err', e?.error?.message ?? 'Failed to cancel.'); },
    });
  }

  publishDispatch(id: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.dispatchActioning.set(id);
    this.orgDispatchService.publish(orgId, id).subscribe({
      next: () => { this.dispatchActioning.set(null); this.loadDispatch(); this.flash('ok', 'Published to open bidding.'); },
      error: (e) => { this.dispatchActioning.set(null); this.flash('err', e?.error?.message ?? 'Failed to publish.'); },
    });
  }

  reassignModalError = signal('');

  openReassign(item: DispatchItem) {
    this.dispatchDetailItem.set(item);
    this.reassignDriverId = '';
    this.reassignModalError.set('');
    this.loadOrgRiders();
    this.reassignModal.set(true);
  }
  closeReassign() { this.reassignModalError.set(''); this.reassignModal.set(false); }

  saveReassign() {
    const orgId = this.orgId();
    const item  = this.dispatchDetailItem();
    if (!orgId || !item || !this.reassignDriverId) return;
    this.dispatchActioning.set(item.id);
    this.orgDispatchService.reassign(orgId, item.id, this.reassignDriverId).subscribe({
      next: () => { this.dispatchActioning.set(null); this.closeReassign(); this.loadDispatch(); this.flash('ok', 'Reassigned successfully.'); },
      error: (e) => { this.dispatchActioning.set(null); this.reassignModalError.set(e?.error?.message ?? 'Failed to reassign.'); },
    });
  }

  dispatchStatusColor(status: string): string {
    const map: Record<string, string> = {
      ASSIGNED: '#f59e0b', ACCEPTED: '#3b82f6', IN_TRANSIT: '#8b5cf6',
      ARRIVED: '#06b6d4', DELIVERED: '#22c55e', DECLINED: '#ef4444',
      PUBLISHED: '#f97316', CANCELLED: '#6b7280',
    };
    return map[status] ?? '#6b7280';
  }

  // ── Members ───────────────────────────────────────────────────────────────
  members           = signal<OrgMember[]>([]);
  membersLoading    = signal(false);
  memberRoleFilter  = signal<string>('');
  memberModal       = signal(false);
  memberSaving      = signal(false);
  memberEditing     = signal<OrgMember | null>(null);
  memberRemovingId  = signal<string | null>(null);
  memberModalError  = signal('');
  memberForm        = { name: '', email: '', phone: '', password: '', role: 'RIDER' as 'RIDER' | 'DISPATCHER' };
  showMemberPassword = signal(false);

  loadMembers() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.membersLoading.set(true);
    const role = this.memberRoleFilter() || undefined;
    this.orgMemberService.list(orgId, role).subscribe({
      next:  r => { this.members.set(Array.isArray(r.data) ? r.data : []); this.membersLoading.set(false); },
      error: () => { this.membersLoading.set(false); this.flash('err', 'Failed to load members.'); },
    });
  }

  openAddMember() {
    this.memberEditing.set(null);
    this.memberForm = { name: '', email: '', phone: '', password: '', role: 'RIDER' };
    this.showMemberPassword.set(false);
    this.memberModalError.set('');
    this.memberModal.set(true);
  }

  openEditMember(m: OrgMember) {
    this.memberEditing.set(m);
    this.memberForm = { name: m.name, email: m.email, phone: m.phone ?? '', password: '', role: m.role };
    this.showMemberPassword.set(false);
    this.memberModalError.set('');
    this.memberModal.set(true);
  }

  closeMemberModal() { this.memberModalError.set(''); this.memberModal.set(false); }

  saveMember() {
    const orgId = this.orgId();
    if (!orgId) return;
    const editing = this.memberEditing();
    this.memberSaving.set(true);

    if (editing) {
      // Update — only send changed fields
      const req: any = {};
      if (this.memberForm.name  !== editing.name)         req['name']  = this.memberForm.name;
      if (this.memberForm.phone !== (editing.phone ?? '')) req['phone'] = this.memberForm.phone;
      if (this.memberForm.role  !== editing.role)         req['role']  = this.memberForm.role;
      this.orgMemberService.update(orgId, editing.id, req).subscribe({
        next: () => { this.memberSaving.set(false); this.closeMemberModal(); this.loadMembers(); this.flash('ok', 'Member updated.'); },
        error: (e) => { this.memberSaving.set(false); this.memberModalError.set(e?.error?.message ?? 'Failed to update member.'); },
      });
    } else {
      this.orgMemberService.add(orgId, {
        name:     this.memberForm.name,
        email:    this.memberForm.email,
        phone:    this.memberForm.phone || undefined,
        password: this.memberForm.password,
        role:     this.memberForm.role,
      }).subscribe({
        next: () => {
          this.memberSaving.set(false);
          this.closeMemberModal();
          this.loadMembers();
          // Invalidate rider cache so dispatch dropdowns reflect new member
          this.orgRiders.set([]);
          this.flash('ok', `${this.memberForm.role === 'RIDER' ? 'Rider' : 'Dispatcher'} added successfully.`);
        },
        error: (e) => { this.memberSaving.set(false); this.memberModalError.set(e?.error?.message ?? 'Failed to add member.'); },
      });
    }
  }

  removeMember(userId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.orgMemberService.remove(orgId, userId).subscribe({
      next:  () => { this.memberRemovingId.set(null); this.loadMembers(); this.orgRiders.set([]); this.flash('ok', 'Member removed from organisation.'); },
      error: (e) => { this.memberRemovingId.set(null); this.flash('err', e?.error?.message ?? 'Failed to remove member.'); },
    });
  }

  memberRoleColor(role: string): string {
    return role === 'RIDER' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700';
  }

  memberStatusColor(status: string): string {
    return status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  private readonly validPages: OrgPage[] = [
    'dashboard', 'dispatch', 'fleet', 'members', 'clients', 'items', 'shops', 'settings', 'user-profile',
  ];

  constructor(
    private router:                 Router,
    private route:                  ActivatedRoute,
    private authService:            AuthService,
    private userService:            UserService,
    private bikeService:            BikeService,
    private shopService:            ShopService,
    private shopItemService:        ShopItemService,
    private clientService:          ClientService,
    private orgDashboardService:    OrgDashboardService,
    private bikeOrgInviteService:   BikeOrgInviteService,
    private orgDispatchService:     OrgDispatchService,
    private orgMemberService:       OrgMemberService,
    private deliveryWsService:      DeliveryWebSocketService,
    private deliveryRequestService: DeliveryRequestService,
    private toastService:           ToastService,
  ) {}

  ngOnInit() {
    const pageParam = this.route.snapshot.queryParamMap.get('page') as OrgPage | null;
    const initial: OrgPage = pageParam && this.validPages.includes(pageParam) ? pageParam : 'dashboard';
    this.activePage.set(initial);

    this.userService.getMyProfile().subscribe({
      next: () => { this.loadPage(initial); },
      error: () => {},
    });

    // Keep the WebSocket alive for the entire dashboard session so we never
    // miss a driverOfferEvent (Spring drops events with no active WS session).
    this.deliveryWsService.connect();
  }

  ngAfterViewInit() {
    if (this.activePage() === 'dashboard') {
      setTimeout(() => {
        this.initDashboardMap();
        this.seedSampleMapData();
      }, 0);
    }
  }

  // TODO: remove once backend returns real dispatch data
  private seedSampleMapData() {
    if (this.dashboardDispatches().length === 0) {
      const now = new Date().toISOString();
      this.dashboardDispatches.set([
        { id: 'd1', status: 'ASSIGNED',   dispatchStrategy: 'DIRECT_ASSIGN', pickupAddress: '74 Jason Moyo Ave',     pickupLat: -17.8292, pickupLng: 31.0522,  dropoffAddress: '22 Samora Machel Ave',  dropoffLat: -17.8340, dropoffLng: 31.0612, distanceKm: 1.8, estimatedDurationMinutes: 12, clientName: 'Alice Moyo',  driverId: null, driverName: 'Tendai M.', driverPhone: null, assignedByName: null, shopId: 's1', shopName: 'CBD Branch',       price: 5.50,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd2', status: 'IN_TRANSIT', dispatchStrategy: 'DIRECT_ASSIGN', pickupAddress: '12 King George Rd',     pickupLat: -17.8050, pickupLng: 31.0338,  dropoffAddress: '5 Harare Drive, Msasa', dropoffLat: -17.8460, dropoffLng: 31.1050, distanceKm: 5.2, estimatedDurationMinutes: 25, clientName: 'Bob Ncube',   driverId: null, driverName: 'Farai K.',  driverPhone: null, assignedByName: null, shopId: 's2', shopName: 'Avondale Branch',  price: 8.00,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd3', status: 'ACCEPTED',   dispatchStrategy: 'INTERNAL_BID',  pickupAddress: '4 Borrowdale Rd',       pickupLat: -17.7612, pickupLng: 31.0874,  dropoffAddress: '18 Fife Ave, Belgravia', dropoffLat: -17.8198, dropoffLng: 31.0480, distanceKm: 3.6, estimatedDurationMinutes: 18, clientName: 'Carol Dube',  driverId: null, driverName: null,       driverPhone: null, assignedByName: null, shopId: 's3', shopName: 'Borrowdale Branch', price: 6.50,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd4', status: 'DECLINED',   dispatchStrategy: 'DIRECT_ASSIGN', pickupAddress: '55 Union Ave, Harare',  pickupLat: -17.8315, pickupLng: 31.0480,  dropoffAddress: '30 Lomagundi Rd, Mbare', dropoffLat: -17.8680, dropoffLng: 30.9950, distanceKm: 7.1, estimatedDurationMinutes: 35, clientName: 'David Sibanda', driverId: null, driverName: 'Simba T.', driverPhone: null, assignedByName: null, shopId: 's1', shopName: 'CBD Branch',       price: 9.00,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
        { id: 'd5', status: 'PUBLISHED',  dispatchStrategy: 'INTERNAL_BID',  pickupAddress: '8 Angwa St, Harare',    pickupLat: -17.8278, pickupLng: 31.0498,  dropoffAddress: '102 Churchill Ave, Highlands', dropoffLat: -17.7990, dropoffLng: 31.0720, distanceKm: 4.4, estimatedDurationMinutes: 22, clientName: 'Eve Mutasa',  driverId: null, driverName: null,       driverPhone: null, assignedByName: null, shopId: null, shopName: null,              price: 7.00,  paymentStatus: null, description: null, priority: null, createdAt: now, updatedAt: null, actualPickupTime: null, actualDeliveryTime: null },
      ]);
    }
    this.refreshMapMarkers();
  }

  ngOnDestroy() {
    this.destroyDashboardMap();
    this.wsSubscription?.unsubscribe();
    this.deliveryWsService.disconnect();
    if (this.repriceCooldownTimer) { clearInterval(this.repriceCooldownTimer); this.repriceCooldownTimer = null; }
  }

  navigate(page: string) {
    const p = page as OrgPage;
    this.activePage.set(p);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: p },
      replaceUrl: true,
    });
    this.loadPage(p);
  }

  private loadPage(page: OrgPage) {
    if (page !== 'dashboard') this.destroyDashboardMap();
    switch (page) {
      case 'dashboard':
        this.loadDashboardStats();
        this.loadDashboardDispatches();
        this.loadShops();
        setTimeout(() => { this.initDashboardMap(); this.seedSampleMapData(); }, 0);
        break;
      case 'dispatch':  this.loadDispatch();       break;
      case 'fleet':     this.loadBikes(); this.loadInvites(); break;
      case 'members':   this.loadMembers();        break;
      case 'shops':     this.loadShops();          break;
      case 'items':     this.loadItems();          break;
      case 'clients':   this.loadClients();        break;
    }
  }

  toggleCollapsed() { this.collapsed.update(v => !v); }
  signOut()         { this.authService.signOut(); }
}

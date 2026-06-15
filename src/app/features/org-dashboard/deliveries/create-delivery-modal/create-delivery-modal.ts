import { Component, OnDestroy, signal, computed, effect, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { GooglePlacesDirective, PlaceResult } from '../../../../core/directives/google-places.directive';
import { OrgDeliveryService } from '../deliveries.service';
import { OrgRider, NearbyRider } from '../../../../core/user.service';
import { ClientService, OrgClient, OrgClientReq } from '../../clients/clients.service';
import { ShopItemService, ShopItem } from '../../shop-items/shop-items.service';
import { ShopService, Shop } from '../../shops/shops.service';
import { DeliveryRequestService, DriverBid } from '../../../../core/delivery-request.service';
import { DeliveryWebSocketService } from '../../../../core/delivery-websocket.service';
import { ToastService } from '../../../../core/toast.service';
import { UserService } from '../../../../core/user.service';
import { DeliveryUiService } from '../deliveries-ui.service';

@Component({
  selector: 'app-create-delivery-modal',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, GooglePlacesDirective],
  templateUrl: './create-delivery-modal.html',
})
export class CreateDeliveryModal implements OnDestroy {
  @Output() created = new EventEmitter<void>();

  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);
  wsConnected = computed(() => this.deliveryWsService.connected());

  // ── Create delivery modal ────────────────────────────────────────────────────
  createDeliveryModal  = signal(false);
  deliveryTab          = signal<'PUBLIC' | 'INTERNAL'>('PUBLIC');
  deliverySaving       = signal(false);
  deliveryModalError   = signal('');
  deliveryForm = {
    dispatchStrategy: 'DIRECT_ASSIGN',
    pickupAddress: '', pickupLat: null as number | null, pickupLng: null as number | null,
    dropoffAddress: '', dropoffLat: null as number | null, dropoffLng: null as number | null,
    description: '', budget: null as number | null,
    driverId: '', orgClientId: '', paymentMethod: 'CASH',
    shopId: '', packageSizeCategory: 'MEDIUM',
  };

  openCreateDelivery() {
    this.deliveryTab.set('PUBLIC');
    this.deliveryForm = {
      dispatchStrategy: 'PUBLIC_BID',
      pickupAddress: '', pickupLat: null, pickupLng: null,
      dropoffAddress: '', dropoffLat: null, dropoffLng: null,
      description: '', budget: this.randomPrice(),
      driverId: '', orgClientId: '', paymentMethod: 'CASH',
      shopId: '', packageSizeCategory: 'MEDIUM',
    };
    this.deliveryClientSearch.set('');
    this.deliveryClientFocused.set(false);
    this.deliveryQuickAdd.set(false);
    this.deliveryQuickForm = { name: '', phone: '', address: '', latitude: null, longitude: null };
    this.deliverySelectedClient.set(null);
    this.deliveryShopPickerOpen.set(false);
    this.deliveryShopPickerDropoffOpen.set(false);
    this.deliveryItemPickerOpen.set(false);
    this.deliveryItemSearch.set('');
    this.deliverySelectedItems.set([]);
    this.deliveryShopId.set('');
    this.deliveryModalError.set('');
    // Reset nearby riders + payment toggle
    this.nearbyRiders.set([]);
    this.nearbyRidersLoading.set(false);
    this.nearbyRidersLoaded.set(false);
    this.osrmAvailable.set(true);
    this.paymentDetailsOpen.set(false);
    // Reset bidding state
    this.publicDeliveryState.set('form');
    this.publicRequestId.set(null);
    this.publicBids.set([]);
    this.publicAcceptingId.set(null);
    this.cancelReasonOpen.set(false);
    this.cancelReasonSelected.set(null);
    this.cancelReasonCustom = '';
    this.repriceValue.set(0);
    this.repriceCooldown.set(0);
    if (this.clients().length === 0) this.loadClients();
    if (this.shops().length === 0) this.loadShops();
    if (this.deliveryTab() === 'INTERNAL') this.maybeFetchNearbyRiders();
    this.loadDeliveryItems();
    this.createDeliveryModal.set(true);
  }

  closeCreateDelivery() {
    if (this.publicDeliveryState() === 'awaiting') return;
    this.deliveryModalError.set('');
    this.createDeliveryModal.set(false);
  }

  private finalCloseModal() {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
    if (this.repriceCooldownTimer) { clearInterval(this.repriceCooldownTimer); this.repriceCooldownTimer = null; }
    this.toast.dismissAllBids();
    this.deliveryModalError.set('');
    this.publicDeliveryState.set('form');
    this.publicRequestId.set(null);
    this.publicBids.set([]);
    this.publicAcceptingId.set(null);
    this.cancelReasonOpen.set(false);
    this.createDeliveryModal.set(false);
    this.created.emit();
  }

  switchDeliveryTab(tab: 'PUBLIC' | 'INTERNAL') {
    this.deliveryTab.set(tab);
    this.deliveryModalError.set('');
    this.deliveryForm = {
      dispatchStrategy: tab === 'PUBLIC' ? 'PUBLIC_BID' : 'DIRECT_ASSIGN',
      pickupAddress: '', pickupLat: null, pickupLng: null,
      dropoffAddress: '', dropoffLat: null, dropoffLng: null,
      description: '', budget: this.randomPrice(),
      driverId: '', orgClientId: '', paymentMethod: 'CASH',
      shopId: '', packageSizeCategory: 'MEDIUM',
    };
    this.deliveryClientSearch.set('');
    this.deliveryClientFocused.set(false);
    this.deliveryQuickAdd.set(false);
    this.deliveryQuickForm = { name: '', phone: '', address: '', latitude: null, longitude: null };
    this.deliverySelectedClient.set(null);
    this.deliveryShopPickerOpen.set(false);
    this.deliveryShopPickerDropoffOpen.set(false);
    this.deliveryItemPickerOpen.set(false);
    this.deliveryItemSearch.set('');
    this.deliverySelectedItems.set([]);
    this.deliveryShopId.set('');
    this.nearbyRiders.set([]);
    this.nearbyRidersLoading.set(false);
    this.nearbyRidersLoaded.set(false);
    this.osrmAvailable.set(true);
    this.paymentDetailsOpen.set(false);
    // Load riders immediately when switching to Direct Assign
    if (tab === 'INTERNAL') this.maybeFetchNearbyRiders();
  }

  saveDelivery() {
    if (this.deliveryTab() === 'PUBLIC') {
      this.savePublicDelivery();
    } else {
      this.saveInternalDelivery();
    }
  }

  // ── Public delivery ──────────────────────────────────────────────────────────
  publicDeliveryState   = signal<'form' | 'awaiting'>('form');
  publicRequestId       = signal<string | null>(null);
  publicBids            = signal<DriverBid[]>([]);
  publicAcceptingId     = signal<string | null>(null);

  private wsSubscription: Subscription | null = null;

  savePublicDelivery() {
    const f = this.deliveryForm;
    this.deliverySaving.set(true);
    this.deliveryModalError.set('');

    const body: Record<string, unknown> = {
      dispatchStrategy:    'PUBLIC_BID',
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
        const deliveryId = r.data?.id;
        if (!deliveryId) {
          this.deliverySaving.set(false);
          this.deliveryModalError.set('No delivery ID returned from server.');
          return;
        }
        this.publicRequestId.set(deliveryId);
        this.repriceValue.set(f.budget ?? 0);
        this.publicBids.set([]);
        this.deliverySaving.set(false);

        this.wsSubscription?.unsubscribe();
        this.wsSubscription = this.deliveryWsService.events$.subscribe(evt => {
          if (evt.type === 'driverOfferEvent') {
            this.onBidReceived(evt.data as unknown as DriverBid);
          } else if (evt.type === 'requestCancelledEvent') {
            this.finalCloseModal();
            this.toast.warning('Request Cancelled', 'Your delivery request has been cancelled.');
          } else if (evt.type === 'requestExpiredEvent') {
            this.finalCloseModal();
            this.toast.warning('Request Expired', 'No drivers responded in time.');
          }
        });

        this.publicDeliveryState.set('awaiting');
        this.startRepriceCooldown();
      },
      error: e => {
        this.deliverySaving.set(false);
        this.deliveryModalError.set(e?.error?.message ?? 'Failed to create request.');
      },
    });
  }

  onBidReceived(data: DriverBid) {
    if (this.publicDeliveryState() !== 'awaiting') return;
    this.publicBids.update(list => [data, ...list.filter(b => b.driverId !== data.driverId)]);
    this.toast.bid(data, (bid, toastId) => {
      this.toast.dismiss(toastId);
      this.acceptBid(bid);
    });
  }

  acceptBid(bid: DriverBid) {
    const requestId = this.publicRequestId();
    if (!requestId || this.publicAcceptingId()) return;
    this.publicAcceptingId.set(bid.driverId);
    this.toast.dismissAllBids();

    this.deliveryRequestService.acceptBid(requestId, bid.driverId).subscribe({
      next: () => {
        this.finalCloseModal();
        this.toast.success('Bid Accepted', `${bid.driverName} is on the way.`);
        this.created.emit();
      },
      error: e => {
        this.publicAcceptingId.set(null);
        this.toast.error('Failed to Accept Bid', e?.error?.message ?? 'Something went wrong.');
      },
    });
  }

  // ── Reprice ──────────────────────────────────────────────────────────────────
  repriceValue          = signal(0);
  repriceLoading        = signal(false);
  repriceCooldown       = signal(0);
  private repriceCooldownTimer: ReturnType<typeof setInterval> | null = null;

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
        this.toast.success('Success', 'Price updated — drivers notified.');
      },
      error: e => {
        this.repriceLoading.set(false);
        if (e?.status === 404) {
          this.toast.error('Error', 'Request expired — no drivers responded in time.');
          this.finalCloseModal();
        } else {
          this.toast.error('Error', e?.error?.message ?? 'Failed to update price.');
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

  // ── Cancel flow ──────────────────────────────────────────────────────────────
  cancelReasonOpen      = signal(false);
  cancelReasonSelected  = signal<string | null>(null);
  cancelReasonCustom    = '';
  cancelLoading         = signal(false);
  readonly cancelReasonPresets = ['Changed my mind', 'Price too high', 'Wrong address', 'Emergency'];

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
      next:  () => { this.cancelLoading.set(false); this.finalCloseModal(); this.toast.warning('Request Cancelled', 'Your delivery request has been cancelled.'); },
      error: () => { this.cancelLoading.set(false); this.finalCloseModal(); },
    });
  }

  // ── Internal delivery ────────────────────────────────────────────────────────
  saveInternalDelivery() {
    const orgId = this.orgId();
    if (!orgId) return;
    const f = this.deliveryForm;
    this.deliverySaving.set(true);
    const body: Record<string, unknown> = {
      dispatchStrategy: f.dispatchStrategy,
      pickupAddress:  f.pickupAddress,
      pickupLat:      f.pickupLat  ?? 0,
      pickupLng:      f.pickupLng  ?? 0,
      dropoffAddress: f.dropoffAddress,
      dropoffLat:     f.dropoffLat ?? 0,
      dropoffLng:     f.dropoffLng ?? 0,
      price:          f.budget     ?? 0,
      paymentMethod:  f.paymentMethod || 'CASH',
    };
    if (f.description)                                           body['description'] = f.description;
    if (f.dispatchStrategy === 'DIRECT_ASSIGN' && f.driverId)   body['driverId']     = f.driverId;
    if (f.orgClientId)                                           body['orgClientId']  = f.orgClientId;

    this.orgDeliveryService.createDelivery(body).subscribe({
      next: () => {
        this.deliverySaving.set(false);
        this.closeCreateDelivery();
        this.toast.success('Success', 'Delivery created.');
        this.created.emit();
      },
      error: e => { this.deliverySaving.set(false); this.deliveryModalError.set(e?.error?.message ?? 'Failed to create delivery.'); },
    });
  }

  // ── Direct Assign UI ─────────────────────────────────────────────────────────
  paymentDetailsOpen  = signal(false);

  // ── Nearby riders (Direct Assign) ────────────────────────────────────────────
  nearbyRiders        = signal<NearbyRider[]>([]);
  nearbyRidersLoading = signal(false);
  nearbyRidersLoaded  = signal(false);
  osrmAvailable       = signal(true);
  onlineRiderCount    = computed(() => this.nearbyRiders().filter(r => r.online).length);

  /**
   * Fetches org riders for the Direct Assign tab.
   * Passes pickup coordinates when available — backend returns riders sorted by road distance.
   * Without coordinates — backend returns all riders sorted online-first.
   * Always shows the spinner so the dispatcher sees the list refreshing.
   */
  maybeFetchNearbyRiders() {
    if (this.deliveryTab() !== 'INTERNAL') return;
    const orgId = this.orgId();
    if (!orgId) return;

    const { pickupLat, pickupLng } = this.deliveryForm;
    this.nearbyRidersLoading.set(true);
    this.nearbyRidersLoaded.set(false);
    this.userService.getNearbyRiders(pickupLat, pickupLng).subscribe({
      next: r => {
        this.nearbyRiders.set(r.data?.riders ?? []);
        this.osrmAvailable.set(r.data?.osrmAvailable ?? true);
        this.nearbyRidersLoading.set(false);
        this.nearbyRidersLoaded.set(true);
      },
      error: () => {
        this.nearbyRiders.set([]);
        this.osrmAvailable.set(true); // HTTP error ≠ OSRM down, don't show the banner
        this.nearbyRidersLoading.set(false);
        this.nearbyRidersLoaded.set(true);
      },
    });
  }

  formatRiderLabel(r: NearbyRider): string {
    let label = r.name;
    if (r.distanceKm != null)        label += ` · ${r.distanceKm.toFixed(1)} km`;
    if (r.durationMinutes != null)   label += ` · ~${Math.round(r.durationMinutes)} min`;
    if (!r.hasLocation)              label += ' · no location';
    else if (!r.online)              label += ' · offline';
    return label;
  }

  // ── Address shortcut helpers (call maybeFetchNearbyRiders after setting coords) ──

  useClientAsPickup() {
    const c = this.deliverySelectedClient();
    if (!c) return;
    this.deliveryForm.pickupAddress = c.address;
    this.deliveryForm.pickupLat     = c.latitude;
    this.deliveryForm.pickupLng     = c.longitude;
    this.maybeFetchNearbyRiders();
  }

  useClientAsDropoff() {
    const c = this.deliverySelectedClient();
    if (!c) return;
    this.deliveryForm.dropoffAddress = c.address;
    this.deliveryForm.dropoffLat     = c.latitude;
    this.deliveryForm.dropoffLng     = c.longitude;
  }

  useShopAsPickup(shop: Shop) {
    this.deliveryForm.pickupAddress = shop.address;
    this.deliveryForm.pickupLat     = shop.latitude;
    this.deliveryForm.pickupLng     = shop.longitude;
    this.deliveryForm.shopId        = shop.id;
    this.deliveryShopId.set(shop.id);
    this.deliveryShopPickerOpen.set(false);
    this.maybeFetchNearbyRiders();
  }

  useShopAsDropoff(shop: Shop) {
    this.deliveryForm.dropoffAddress = shop.address;
    this.deliveryForm.dropoffLat     = shop.latitude;
    this.deliveryForm.dropoffLng     = shop.longitude;
    this.deliveryShopPickerDropoffOpen.set(false);
  }

  // ── Client search in delivery form ───────────────────────────────────────────
  clients                      = signal<OrgClient[]>([]);
  deliveryClientSearch         = signal('');
  deliveryClientFocused        = signal(false);
  deliveryQuickAdd             = signal(false);
  deliveryQuickForm            = { name: '', phone: '', address: '', latitude: null as number | null, longitude: null as number | null };
  deliveryQuickSaving          = signal(false);
  quickClientModalError        = signal('');
  deliverySelectedClient       = signal<OrgClient | null>(null);
  deliveryShopPickerOpen       = signal(false);
  deliveryShopPickerDropoffOpen = signal(false);

  filteredDeliveryClients = computed(() => {
    const q = this.deliveryClientSearch().toLowerCase().trim();
    if (!q) return this.clients();
    return this.clients().filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)
    );
  });

  loadClients() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.clientService.getAll(orgId).subscribe({
      next: r => this.clients.set(r.data ?? []),
      error: () => {},
    });
  }

  selectDeliveryClient(c: OrgClient) {
    this.deliveryForm.orgClientId = c.id;
    this.deliveryClientSearch.set(c.name);
    this.deliveryClientFocused.set(false);
    this.deliveryQuickAdd.set(false);
    this.deliverySelectedClient.set(c);
  }

  openDeliveryQuickAdd() {
    this.deliveryQuickForm = { name: this.deliveryClientSearch(), phone: '', address: '', latitude: null, longitude: null };
    this.quickClientModalError.set('');
    this.deliveryQuickAdd.set(true);
    this.deliveryClientFocused.set(false);
  }

  closeDeliveryQuickAdd() {
    this.quickClientModalError.set('');
    this.deliveryQuickAdd.set(false);
  }

  saveQuickDeliveryClient() {
    const orgId = this.orgId();
    if (!orgId || !this.deliveryQuickForm.name.trim()) return;
    this.deliveryQuickSaving.set(true);
    this.clientService.create(orgId, {
      name:      this.deliveryQuickForm.name.trim(),
      phone:     this.deliveryQuickForm.phone     || undefined,
      address:   this.deliveryQuickForm.address   || undefined,
      latitude:  this.deliveryQuickForm.latitude  ?? undefined,
      longitude: this.deliveryQuickForm.longitude ?? undefined,
    }).subscribe({
      next: r => {
        const c = r.data;
        this.clients.update(list => [...list, c]);
        this.deliveryForm.orgClientId = c.id;
        this.deliveryClientSearch.set(c.name);
        this.deliverySelectedClient.set(c);
        this.closeDeliveryQuickAdd();
        this.deliveryQuickSaving.set(false);
        this.deliveryQuickForm = { name: '', phone: '', address: '', latitude: null, longitude: null };
        this.toast.success('Success', 'Client added.');
      },
      error: e => {
        this.deliveryQuickSaving.set(false);
        this.quickClientModalError.set(e?.error?.message ?? 'Failed to add client.');
      },
    });
  }

  // ── Item picker ──────────────────────────────────────────────────────────────
  shopItems                = signal<ShopItem[]>([]);
  shops                    = signal<Shop[]>([]);
  deliveryItemPickerOpen   = signal(false);
  deliveryItemSearch       = signal('');
  deliveryItemsLoading     = signal(false);
  deliverySelectedItems    = signal<{ item: ShopItem; qty: number }[]>([]);
  deliveryShopId           = signal('');

  deliveryShopItems = computed(() => {
    const q = this.deliveryItemSearch().toLowerCase().trim();
    return q
      ? this.shopItems().filter(i => i.name.toLowerCase().includes(q))
      : this.shopItems();
  });

  loadDeliveryItems() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.deliveryItemsLoading.set(true);
    this.shopItemService.getAllByOrg(orgId).subscribe({
      next:  r => { this.shopItems.set(r.data ?? []); this.deliveryItemsLoading.set(false); },
      error: () => { this.deliveryItemsLoading.set(false); },
    });
  }

  loadShops() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopService.getAll(orgId).subscribe({
      next: r => this.shops.set(r.data ?? []),
      error: () => {},
    });
  }

  addDeliveryItem(item: ShopItem) {
    const existing = this.deliverySelectedItems().find(s => s.item.id === item.id);
    if (existing) {
      this.deliverySelectedItems.update(list =>
        list.map(s => s.item.id === item.id ? { ...s, qty: s.qty + 1 } : s)
      );
    } else {
      this.deliverySelectedItems.update(list => [...list, { item, qty: 1 }]);
    }
    this.syncDeliveryDescription();
  }

  removeDeliveryItem(itemId: string) {
    this.deliverySelectedItems.update(list => list.filter(s => s.item.id !== itemId));
    this.syncDeliveryDescription();
  }

  updateDeliveryItemQty(itemId: string, qty: number) {
    if (qty < 1) { this.removeDeliveryItem(itemId); return; }
    this.deliverySelectedItems.update(list =>
      list.map(s => s.item.id === itemId ? { ...s, qty } : s)
    );
    this.syncDeliveryDescription();
  }

  readonly totalQty = (acc: number, s: { qty: number }) => acc + s.qty;
  selectedQty(itemId: string): number {
    return this.deliverySelectedItems().find(s => s.item.id === itemId)?.qty ?? 0;
  }

  syncDeliveryDescription() {
    const merged = new Map<string, { item: ShopItem; qty: number }>();
    for (const s of this.deliverySelectedItems()) {
      const existing = merged.get(s.item.id);
      merged.set(s.item.id, { item: s.item, qty: (existing?.qty ?? 0) + s.qty });
    }
    const lines = Array.from(merged.values()).map(s => {
      let label = `${s.qty}x ${s.item.name}`;
      if (s.item.sku)  label += ` [${s.item.sku}]`;
      if (s.item.unit) label += ` (${s.item.unit})`;
      return label;
    });
    this.deliveryForm.description = lines.join(', ');
  }

  // ── Google Places handlers ───────────────────────────────────────────────────
  onPickupPlaceSelected(p: PlaceResult) {
    this.deliveryForm.pickupAddress = p.address;
    this.deliveryForm.pickupLat     = p.lat;
    this.deliveryForm.pickupLng     = p.lng;
    this.maybeFetchNearbyRiders();
  }

  onDropoffPlaceSelected(p: PlaceResult) {
    this.deliveryForm.dropoffAddress = p.address;
    this.deliveryForm.dropoffLat     = p.lat;
    this.deliveryForm.dropoffLng     = p.lng;
  }

  onQuickClientAddressSelected(p: PlaceResult) {
    this.deliveryQuickForm.address   = p.address;
    this.deliveryQuickForm.latitude  = p.lat;
    this.deliveryQuickForm.longitude = p.lng;
  }

  // TODO: replace with pricing algorithm
  randomPrice(): number {
    return parseFloat((3 + Math.random() * 7).toFixed(2));
  }

  constructor(
    private orgDeliveryService:      OrgDeliveryService,
    private clientService:           ClientService,
    private shopItemService:         ShopItemService,
    private shopService:             ShopService,
    private deliveryRequestService:  DeliveryRequestService,
    private deliveryWsService:       DeliveryWebSocketService,
    private toast:                   ToastService,
    private userService:             UserService,
    private deliveryUiService:       DeliveryUiService,
  ) {
    effect(() => {
      if (this.deliveryUiService.openCreate()) {
        this.openCreateDelivery();
        this.deliveryUiService.close();
      }
    });
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
    if (this.repriceCooldownTimer) { clearInterval(this.repriceCooldownTimer); this.repriceCooldownTimer = null; }
  }
}

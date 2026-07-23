import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ShopService, Shop, ShopReq } from '../shops.service';
import { ShopItemService, ShopItem, ShopItemReq } from '../../shop-items/shop-items.service';
import { ToastService } from '../../../../core/toast.service';
import { GooglePlacesDirective, PlaceResult } from '../../../../core/directives/google-places.directive';

@Component({
  selector: 'app-shop-detail',
  standalone: true,
  imports: [FormsModule, RouterModule, GooglePlacesDirective],
  templateUrl: './shop-detail.html',
})
export class ShopDetail implements OnInit {
  private readonly route_ = inject(ActivatedRoute);
  readonly shopId = this.route_.snapshot.paramMap.get('shopId')!;

  // ── Shop ──────────────────────────────────────────────────────────────────────
  shop           = signal<Shop | null>(null);
  shopLoading    = signal(false);
  shopModal      = signal(false);
  shopModalError = signal('');
  shopForm       = { name: '', address: '', phone: '', latitude: null as number | null, longitude: null as number | null };

  loadShop() {
    this.shopLoading.set(true);
    this.shopService.getById(this.shopId).subscribe({
      next: r => { this.shop.set(r.data ?? null); this.shopLoading.set(false); },
      error: () => { this.shopLoading.set(false); },
    });
  }

  openShopModal() {
    const s = this.shop();
    if (!s) return;
    this.shopForm = { name: s.name, address: s.address ?? '', phone: s.phone ?? '', latitude: s.latitude ?? null, longitude: s.longitude ?? null };
    this.shopModalError.set('');
    this.shopModal.set(true);
  }
  closeShopModal() { this.shopModalError.set(''); this.shopModal.set(false); }

  saveShop() {
    const s = this.shop();
    if (!s) return;
    const req: ShopReq = {
      name:      this.shopForm.name,
      address:   this.shopForm.address   || undefined,
      phone:     this.shopForm.phone     || undefined,
      latitude:  this.shopForm.latitude  ?? undefined,
      longitude: this.shopForm.longitude ?? undefined,
    };
    this.shopService.update(s.id, req).subscribe({
      next: r => { this.shop.set(r.data); this.closeShopModal(); this.toast.success('Success', 'Shop updated.'); },
      error: (e) => { this.shopModalError.set(e?.error?.message ?? 'Failed to save shop.'); },
    });
  }

  onShopAddressSelected(p: PlaceResult) {
    this.shopForm.address   = p.address;
    this.shopForm.latitude  = p.lat;
    this.shopForm.longitude = p.lng;
  }

  // ── Items — pagination ────────────────────────────────────────────────────────
  readonly pageSize = 20;

  items        = signal<ShopItem[]>([]);
  totalItems   = signal(0);
  currentPage  = signal(0);
  itemsLoading = signal(false);

  totalPages  = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize)));
  pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    const start = Math.max(0, Math.min(cur - 2, total - 5));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });

  loadPage(page: number) {
    this.itemsLoading.set(true);
    this.currentPage.set(page);
    this.shopItemService.getByShop(this.shopId, page, this.pageSize).subscribe({
      next: r => {
        this.items.set(r.data ?? []);
        this.totalItems.set(r.length ?? 0);
        this.itemsLoading.set(false);
      },
      error: () => { this.itemsLoading.set(false); this.toast.error('Error', 'Failed to load items.'); },
    });
  }

  setPage(page: number) {
    if (page < 0 || page >= this.totalPages() || page === this.currentPage()) return;
    if (this.isSearchMode()) {
      this.runBackendSearch(this.searchQuery(), page);
    } else {
      this.loadPage(page);
    }
  }

  // ── Items — search ────────────────────────────────────────────────────────────
  searchQuery   = signal('');
  isSearchMode  = signal(false);
  searchLoading = signal(false);

  localMatches = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return this.items().filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q) ||
      (i.sku ?? '').toLowerCase().includes(q) ||
      (i.unit ?? '').toLowerCase().includes(q)
    );
  });

  displayItems = computed(() => {
    const q = this.searchQuery().trim();
    if (!q) return this.items();
    if (this.localMatches().length > 0) return this.localMatches();
    return this.items();
  });

  displayTotal = computed(() => {
    const q = this.searchQuery().trim();
    if (!q) return this.totalItems();
    if (this.localMatches().length > 0) return this.localMatches().length;
    return this.totalItems();
  });

  onSearch(q: string) {
    this.searchQuery.set(q);
    if (!q.trim()) { this.clearSearch(); return; }
    if (this.localMatches().length > 0) { this.isSearchMode.set(false); return; }
    this.runBackendSearch(q, 0);
  }

  runBackendSearch(q: string, page = 0) {
    this.searchLoading.set(true);
    this.currentPage.set(page);
    this.shopItemService.getByShop(this.shopId, page, this.pageSize, q).subscribe({
      next: r => {
        this.items.set(r.data ?? []);
        this.totalItems.set(r.length ?? 0);
        this.isSearchMode.set(true);
        this.searchLoading.set(false);
      },
      error: () => { this.searchLoading.set(false); },
    });
  }

  clearSearch() {
    this.searchQuery.set('');
    this.isSearchMode.set(false);
    this.currentPage.set(0);
    this.loadPage(0);
  }

  // ── Items — CRUD ──────────────────────────────────────────────────────────────
  itemModal      = signal(false);
  itemEditing    = signal<ShopItem | null>(null);
  itemDeletingId = signal<string | null>(null);
  itemModalError = signal('');
  itemForm       = { name: '', description: '', sku: '', unit: '' };

  openItemModal(item?: ShopItem) {
    this.itemEditing.set(item ?? null);
    this.itemForm = item
      ? { name: item.name, description: item.description ?? '', sku: item.sku ?? '', unit: item.unit ?? '' }
      : { name: '', description: '', sku: '', unit: '' };
    this.itemModalError.set('');
    this.itemModal.set(true);
  }
  closeItemModal() { this.itemModalError.set(''); this.itemModal.set(false); }

  saveItem() {
    const editing = this.itemEditing();
    this.itemsLoading.set(true);
    const req: ShopItemReq = {
      name:        this.itemForm.name,
      description: this.itemForm.description || undefined,
      sku:         this.itemForm.sku         || undefined,
      unit:        this.itemForm.unit        || undefined,
    };
    const obs = editing
      ? this.shopItemService.update(editing.id, req)
      : this.shopItemService.create(this.shopId, req);

    obs.subscribe({
      next: () => {
        this.closeItemModal();
        if (this.isSearchMode()) {
          this.runBackendSearch(this.searchQuery(), this.currentPage());
        } else {
          this.loadPage(this.currentPage());
        }
        this.toast.success('Success', editing ? 'Item updated.' : 'Item added.');
      },
      error: (e) => { this.itemsLoading.set(false); this.itemModalError.set(e?.error?.message ?? 'Failed to save item.'); },
    });
  }

  deleteItem() {
    const itemId = this.itemDeletingId();
    if (!itemId) return;
    this.shopItemService.delete(itemId).subscribe({
      next: () => {
        this.itemDeletingId.set(null);
        const goTo = this.items().length === 1 && this.currentPage() > 0
          ? this.currentPage() - 1 : this.currentPage();
        if (this.isSearchMode()) {
          this.runBackendSearch(this.searchQuery(), goTo);
        } else {
          this.loadPage(goTo);
        }
        this.toast.success('Success', 'Item deleted.');
      },
      error: (e) => { this.itemDeletingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to delete item.'); },
    });
  }

  constructor(
    private route:           ActivatedRoute,
    private router:          Router,
    private shopService:     ShopService,
    private shopItemService: ShopItemService,
    private toast:           ToastService,
  ) {}

  ngOnInit() {
    this.loadShop();
    this.loadPage(0);
  }

  rangeEnd(page: number, total: number): number {
    return Math.min((page + 1) * this.pageSize, total);
  }

  goBack() {
    this.router.navigate(['/org/shops']);
  }
}

import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShopItemService, ShopItem, ShopItemReq } from './shop-items.service';
import { ShopService, Shop } from '../shops/shops.service';
import { UserService } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-shop-items',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './shop-items.html',
})
export class ShopItems implements OnInit {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  shopItems        = signal<ShopItem[]>([]);
  itemsLoading     = signal(false);
  itemModal        = signal(false);
  itemEditing      = signal<ShopItem | null>(null);
  itemDeletingId   = signal<string | null>(null);
  itemModalError   = signal('');
  itemForm         = { shopId: '', name: '', description: '', sku: '', unit: '' };

  shops            = signal<Shop[]>([]);

  loadShops() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopService.getAll(orgId).subscribe({
      next: r => this.shops.set(r.data ?? []),
      error: () => {},
    });
  }

  loadItems() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.itemsLoading.set(true);
    if (this.shops().length === 0) this.loadShops();
    this.shopItemService.getAllByOrg(orgId).subscribe({
      next:  r => { this.shopItems.set(r.data ?? []); this.itemsLoading.set(false); },
      error: () => { this.itemsLoading.set(false); this.toast.error('Error', 'Failed to load items.'); },
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
      next: () => { this.closeItemModal(); this.loadItems(); this.toast.success('Success', editing ? 'Item updated.' : 'Item added.'); },
      error: (e) => { this.itemsLoading.set(false); this.itemModalError.set(e?.error?.message ?? 'Failed to save item.'); },
    });
  }

  deleteItem(item: ShopItem) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopItemService.delete(orgId, item.shopId, item.id).subscribe({
      next:  () => { this.itemDeletingId.set(null); this.loadItems(); this.toast.success('Success', 'Item deleted.'); },
      error: (e) => { this.itemDeletingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to delete item.'); },
    });
  }

  deleteConfirmedItem() {
    const item = this.shopItems().find(i => i.id === this.itemDeletingId());
    if (item) this.deleteItem(item);
  }

  constructor(
    private shopItemService: ShopItemService,
    private shopService:     ShopService,
    private userService:     UserService,
    private toast:           ToastService,
  ) {}

  ngOnInit() {
    this.loadItems();
  }
}

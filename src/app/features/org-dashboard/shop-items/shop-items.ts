import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShopItemService, ShopItem, ShopItemReq } from './shop-items.service';
import { ShopService, Shop } from '../shops/shops.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-shop-items',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './shop-items.html',
})
export class ShopItems implements OnInit {
  shopItems        = signal<ShopItem[]>([]);
  itemsLoading     = signal(false);
  itemModal        = signal(false);
  itemEditing      = signal<ShopItem | null>(null);
  itemDeletingId   = signal<string | null>(null);
  itemModalError   = signal('');
  itemForm         = { shopId: '', name: '', description: '', sku: '', unit: '' };

  shops            = signal<Shop[]>([]);

  loadShops() {
    this.shopService.getAll(0, 100).subscribe({
      next: r => this.shops.set(r.data ?? []),
      error: () => {},
    });
  }

  loadItems() {
    this.itemsLoading.set(true);
    if (this.shops().length === 0) this.loadShops();
    this.shopItemService.getAll(0, 200).subscribe({
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
    if (!this.itemForm.shopId) { this.itemModalError.set('Please select a shop.'); return; }
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
      : this.shopItemService.create(this.itemForm.shopId, req);

    obs.subscribe({
      next: () => { this.closeItemModal(); this.loadItems(); this.toast.success('Success', editing ? 'Item updated.' : 'Item added.'); },
      error: (e) => { this.itemsLoading.set(false); this.itemModalError.set(e?.error?.message ?? 'Failed to save item.'); },
    });
  }

  deleteItem(item: ShopItem) {
    this.shopItemService.delete(item.id).subscribe({
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
    private toast:           ToastService,
  ) {}

  ngOnInit() {
    this.loadItems();
  }
}

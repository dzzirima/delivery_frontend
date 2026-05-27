import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GooglePlacesDirective, PlaceResult } from '../../../core/directives/google-places.directive';
import { ShopService, Shop, ShopReq } from './shops.service';
import { UserService } from '../../users/services/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-shops',
  standalone: true,
  imports: [FormsModule, GooglePlacesDirective, RouterModule],
  templateUrl: './shops.html',
})
export class Shops implements OnInit {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

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
      next:  r => { this.shops.set(r.data ?? []); this.shopsLoading.set(false); },
      error: () => { this.shopsLoading.set(false); this.toast.error('Error', 'Failed to load shops.'); },
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
      next: () => { this.closeShopModal(); this.loadShops(); this.toast.success('Success', editing ? 'Shop updated.' : 'Shop created.'); },
      error: (e) => { this.shopsLoading.set(false); this.shopModalError.set(e?.error?.message ?? 'Failed to save shop.'); },
    });
  }

  deleteShop(shopId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.shopService.delete(orgId, shopId).subscribe({
      next:  () => { this.shopDeletingId.set(null); this.loadShops(); this.toast.success('Success', 'Shop deleted.'); },
      error: (e) => { this.shopDeletingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to delete shop.'); },
    });
  }

  onShopAddressSelected(p: PlaceResult) {
    this.shopForm.address   = p.address;
    this.shopForm.latitude  = p.lat;
    this.shopForm.longitude = p.lng;
  }

  constructor(
    private shopService:  ShopService,
    private userService:  UserService,
    private toast:        ToastService,
  ) {}

  ngOnInit() {
    this.loadShops();
  }
}

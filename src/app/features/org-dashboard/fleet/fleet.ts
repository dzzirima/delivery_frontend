import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BikeService, Bike, BikeReq } from './fleet.service';
import { BikeOrgInviteService, BikeOrgInvite } from './bike-invite.service';
import { UserService, OrgRider } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-fleet',
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe],
  templateUrl: './fleet.html',
})
export class Fleet implements OnInit {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  // ── Bikes ────────────────────────────────────────────────────────────────────
  bikes          = signal<Bike[]>([]);
  bikesLoading   = signal(false);
  bikeModal      = signal(false);
  bikeEditing    = signal<Bike | null>(null);
  bikeDeletingId = signal<string | null>(null);
  bikeModalError = signal('');
  bikeForm       = { make: '', model: '', licensePlate: '', vin: '' };

  loadBikes() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.bikesLoading.set(true);
    this.bikeService.getAll(orgId).subscribe({
      next:  r => { this.bikes.set(Array.isArray(r.data) ? r.data : []); this.bikesLoading.set(false); },
      error: () => { this.bikesLoading.set(false); this.toast.error('Error', 'Failed to load fleet.'); },
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
      next: () => { this.closeBikeModal(); this.loadBikes(); this.toast.success('Success', editing ? 'Bike updated.' : 'Bike registered.'); },
      error: (e) => { this.bikesLoading.set(false); this.bikeModalError.set(e?.error?.message ?? 'Failed to save bike.'); },
    });
  }

  deleteBike(bikeId: string) {
    this.bikeService.delete(bikeId).subscribe({
      next:  () => { this.bikeDeletingId.set(null); this.loadBikes(); this.toast.success('Success', 'Bike removed.'); },
      error: (e) => { this.bikeDeletingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to delete bike.'); },
    });
  }

  // ── Rider–bike pairing ───────────────────────────────────────────────────────
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
        this.toast.success('Success', 'Rider paired successfully.');
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
        this.toast.success('Success', 'Rider unassigned.');
      },
      error: e => { this.unpairingSaving.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to unassign rider.'); },
    });
  }

  // ── Invites ──────────────────────────────────────────────────────────────────
  invites            = signal<BikeOrgInvite[]>([]);
  invitesLoading     = signal(false);
  inviteModal        = signal(false);
  inviteSearch       = '';
  inviteResults      = signal<Bike[]>([]);
  inviteSearching    = signal(false);
  inviteSendingId    = signal<string | null>(null);
  inviteCancellingId = signal<string | null>(null);
  fleetTab           = signal<'bikes' | 'invites'>('bikes');

  loadInvites() {
    const orgId = this.orgId();
    if (!orgId) return;
    this.invitesLoading.set(true);
    this.bikeOrgInviteService.list(orgId).subscribe({
      next:  r => { this.invites.set(Array.isArray(r.data) ? r.data : []); this.invitesLoading.set(false); },
      error: () => { this.invitesLoading.set(false); this.toast.error('Error', 'Failed to load invites.'); },
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
      error: () => { this.inviteSearching.set(false); this.toast.error('Error', 'Search failed.'); },
    });
  }

  sendInvite(bikeId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.inviteSendingId.set(bikeId);
    this.bikeOrgInviteService.send(orgId, bikeId).subscribe({
      next:  () => { this.inviteSendingId.set(null); this.closeInviteModal(); this.loadInvites(); this.fleetTab.set('invites'); this.toast.success('Success', 'Invite sent to bike owner.'); },
      error: (e) => { this.inviteSendingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to send invite.'); },
    });
  }

  cancelInvite(inviteId: string) {
    const orgId = this.orgId();
    if (!orgId) return;
    this.inviteCancellingId.set(inviteId);
    this.bikeOrgInviteService.cancel(orgId, inviteId).subscribe({
      next:  () => { this.inviteCancellingId.set(null); this.loadInvites(); this.toast.success('Success', 'Invite cancelled.'); },
      error: (e) => { this.inviteCancellingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to cancel.'); },
    });
  }

  // ── Org riders (for pair modal) ──────────────────────────────────────────────
  orgRiders     = signal<OrgRider[]>([]);
  ridersLoading = signal(false);

  loadOrgRiders() {
    const orgId = this.orgId();
    if (!orgId || this.orgRiders().length > 0) return;
    this.ridersLoading.set(true);
    this.userService.getRiders().subscribe({
      next:  r => { this.orgRiders.set(Array.isArray(r.data) ? r.data : []); this.ridersLoading.set(false); },
      error: () => { this.ridersLoading.set(false); },
    });
  }

  constructor(
    private bikeService:          BikeService,
    private bikeOrgInviteService: BikeOrgInviteService,
    private userService:          UserService,
    private toast:                ToastService,
  ) {}

  ngOnInit() {
    this.loadBikes();
    this.loadInvites();
  }
}

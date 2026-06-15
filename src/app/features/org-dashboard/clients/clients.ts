import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GooglePlacesDirective, PlaceResult } from '../../../core/directives/google-places.directive';
import { ClientService, OrgClient, OrgClientReq } from './clients.service';
import { UserService } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [FormsModule, GooglePlacesDirective, RouterModule],
  templateUrl: './clients.html',
})
export class Clients implements OnInit {
  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

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
      error: () => { this.clientsLoading.set(false); this.toast.error('Error', 'Failed to load clients.'); },
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
      next: () => { this.closeClientModal(); this.loadClients(); this.toast.success('Success', editing ? 'Client updated.' : 'Client added.'); },
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
      next:  () => { this.clientDeletingId.set(null); this.loadClients(); this.toast.success('Success', 'Client removed.'); },
      error: (e) => { this.clientDeletingId.set(null); this.toast.error('Error', e?.error?.message ?? 'Failed to delete client.'); },
    });
  }

  onClientAddressSelected(p: PlaceResult) {
    this.clientForm.address   = p.address;
    this.clientForm.latitude  = p.lat;
    this.clientForm.longitude = p.lng;
  }

  constructor(
    private clientService: ClientService,
    private userService:   UserService,
    private toast:         ToastService,
  ) {}

  ngOnInit() {
    this.loadClients();
  }
}

import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from './services/organization.service';
import { ToastService } from '../../core/toast.service';
import { Organization, OrganizationPayload } from './models/organization.model';

@Component({
  selector: 'app-organizations',
  imports: [FormsModule],
  templateUrl: './organizations.html',
})
export class OrganizationsPage implements OnInit {
  organizations = signal<Organization[]>([]);
  loading = signal(false);
  error = signal('');
  totalElements = signal(0);

  showForm = signal(false);
  editing = signal<Organization | null>(null);
  saving = signal(false);

  form: OrganizationPayload = this.emptyForm();

  constructor(private orgService: OrganizationService, private toast: ToastService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.orgService.getAll({ page: 0, size: 50 }).subscribe({
      next: res => {
        this.organizations.set(res.data?.content ?? []);
        this.totalElements.set(res.data?.totalElements ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load organizations.');
        this.loading.set(false);
      },
    });
  }

  openNew() {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.showForm.set(true);
  }

  openEdit(org: Organization) {
    this.editing.set(org);
    this.form = { name: org.name, slug: org.slug, email: org.email, phone: org.phone ?? '' };
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editing.set(null);
  }

  save() {
    if (!this.form.name.trim() || !this.form.slug.trim() || !this.form.email.trim()) return;
    this.saving.set(true);
    const item = this.editing();
    const req$ = item
      ? this.orgService.update(item.id, this.form)
      : this.orgService.create(this.form);

    req$.subscribe({
      next: () => {
        this.toast.success(item ? 'Organisation updated!' : 'Organisation created!');
        this.closeForm();
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.toast.error('Failed to save organisation.');
        this.saving.set(false);
      },
    });
  }

  delete(id: string) {
    if (!confirm('Delete this organisation? This cannot be undone.')) return;
    this.orgService.delete(id).subscribe({
      next: () => {
        this.toast.success('Organisation deleted.');
        this.organizations.update(list => list.filter(o => o.id !== id));
        this.totalElements.update(n => n - 1);
      },
      error: () => this.toast.error('Failed to delete organisation.'),
    });
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE:   'bg-green-100 text-green-700',
      SUSPENDED:'bg-amber-100 text-amber-700',
      ARCHIVED: 'bg-gray-100 text-gray-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  }

  private emptyForm(): OrganizationPayload {
    return { name: '', slug: '', email: '', phone: '' };
  }
}

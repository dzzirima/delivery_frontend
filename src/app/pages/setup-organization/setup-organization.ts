import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../features/organizations/services/organization.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-setup-organization',
  imports: [FormsModule],
  templateUrl: './setup-organization.html',
})
export class SetupOrganization {
  name = '';
  slug = '';
  email = '';
  phone = '';

  slugManuallyEdited = false;
  loading = signal(false);
  error = signal('');

  constructor(
    private router: Router,
    private orgService: OrganizationService,
    private authService: AuthService,
    private toast: ToastService,
  ) {}

  onNameChange() {
    if (!this.slugManuallyEdited) {
      this.slug = this.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
  }

  onSlugChange() {
    this.slugManuallyEdited = true;
  }

  signOut() {
    this.authService.signOut();
  }

  submit() {
    if (!this.name || !this.slug || !this.email) {
      this.error.set('Please fill in all required fields.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.orgService.create({ name: this.name, slug: this.slug, email: this.email, phone: this.phone || undefined }).subscribe({
      next: () => {
        this.toast.success('Organisation created!', 'Your organisation is ready. Welcome to GigMaster.');
        setTimeout(() => this.router.navigate(['/app/dashboard']), 1500);
      },
      error: (err) => {
        const body = err?.error;
        const fieldErrors: Record<string, string> = body?.errors ?? {};
        const fieldMessages = Object.values(fieldErrors);
        const msg = fieldMessages.length > 0 ? fieldMessages.join(' ') : body?.message || 'Failed to create organisation. Please try again.';
        this.error.set(msg);
        this.toast.error('Failed to create organisation', msg);
        this.loading.set(false);
      },
    });
  }
}

import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GigPayload, EQUIPMENT_TYPES, EquipmentType } from '../models/gig.model';
import { GigService } from '../services/gig.service';
import { ToastService } from '../../../core/toast.service';

@Component({
  selector: 'app-gig-create',
  imports: [FormsModule],
  templateUrl: './gig-create.html',
})
export class GigCreate implements OnInit {
  readonly equipmentTypes = EQUIPMENT_TYPES;

  applicationId = '';
  company = '';
  position = '';

  saving = signal(false);
  error = signal('');

  form: Omit<GigPayload, 'applicationId'> = {
    startingDate: '',
    endDate: null,
    orientationDateTime: null,
    orientationNotes: null,
    startDateLink: null,
    payRate: 0,
    maximumHoursPerDay: null,
    equipmentType: 'COMPANY_OFFER',
    computerInformation: null,
    duration: 1,
    possibilityOfExtension: false,
    overtimeRate: 1.5,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gigService: GigService,
    private toast: ToastService,
  ) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    this.applicationId = params['applicationId'] ?? '';
    this.company       = params['company'] ?? '';
    this.position      = params['position'] ?? '';
  }

  submit() {
    if (!this.form.startingDate || !this.form.payRate || !this.form.duration) return;
    this.saving.set(true);
    this.error.set('');

    const payload: GigPayload = {
      applicationId: this.applicationId,
      ...this.form,
      orientationDateTime: this.form.orientationDateTime ? this.toISODateTime(this.form.orientationDateTime) : null,
    };

    this.gigService.create(payload).subscribe({
      next: res => {
        this.toast.success('Gig created successfully!');
        this.router.navigate(['/app/gigs', res.data!.id]);
      },
      error: err => {
        this.error.set(err?.error?.message ?? 'Failed to create gig.');
        this.saving.set(false);
      },
    });
  }

  cancel() {
    this.router.navigate(['/app/applications', this.applicationId]);
  }

  equipmentLabel(type: EquipmentType): string {
    return type === 'COMPANY_OFFER' ? 'Company Offer' : 'Own Equipment';
  }

  private toISODateTime(dt: string): string {
    const normalised = dt.replace(' ', 'T');
    return normalised.length === 16 ? normalised + ':00' : normalised;
  }
}

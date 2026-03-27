import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Application,
  ApplicationPayload,
  APPLICATION_STATUSES,
  PROFILE_NAMES,
} from '../../models/application.model';

@Component({
  selector: 'app-application-form',
  imports: [FormsModule],
  templateUrl: './app-form.html',
})
export class AppForm implements OnInit {
  @Input() application: Application | null = null;
  @Output() saved = new EventEmitter<ApplicationPayload>();
  @Output() cancelled = new EventEmitter<void>();

  readonly statuses = APPLICATION_STATUSES;
  readonly profiles = PROFILE_NAMES;

  form: ApplicationPayload = {
    profileName: 'Peter',
    company: '',
    position: '',
    recruitingAgent: '',
    platform: '',
    status: 'APPLIED',
    followUpDate: '',
    notes: '',
  };

  ngOnInit() {
    if (this.application) {
      this.form = {
        profileName: this.application.profileName,
        company: this.application.company,
        position: this.application.position,
        recruitingAgent: this.application.recruitingAgent ?? '',
        platform: this.application.platform ?? '',
        status: this.application.status,
        followUpDate: this.application.followUpDate ?? '',
        notes: this.application.notes ?? '',
      };
    }
  }

  submit() {
    if (!this.form.company.trim() || !this.form.position.trim()) return;
    this.saved.emit({ ...this.form });
  }

  cancel() {
    this.cancelled.emit();
  }

  get title(): string {
    return this.application ? 'Edit Application' : 'New Application';
  }
}

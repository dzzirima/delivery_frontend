import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DeliveryUiService {
  readonly openCreate = signal(false);
  open()  { this.openCreate.set(true);  }
  close() { this.openCreate.set(false); }
}

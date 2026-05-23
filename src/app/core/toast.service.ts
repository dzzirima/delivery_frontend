import { Injectable, signal } from '@angular/core';
import { DriverBid } from '../features/delivery/services/delivery-request.service';

export type ToastType = 'success' | 'error' | 'info' | 'bid';

export interface Toast {
  id:       number;
  type:     ToastType;
  title:    string;
  message?: string;
  // bid-only
  bid?:     DriverBid;
  onAccept?: (bid: DriverBid, toastId: number) => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  toasts = signal<Toast[]>([]);

  show(type: ToastType, title: string, message?: string, duration = 4000) {
    const id = ++this.counter;
    this.toasts.update(list => [...list, { id, type, title, message }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(title: string, message?: string) { this.show('success', title, message); }
  error(title: string, message?: string)   { this.show('error',   title, message); }
  info(title: string, message?: string)    { this.show('info',    title, message); }

  /** Show a driver-bid toast with Accept / Decline actions. Auto-dismisses after 60 s. */
  bid(bid: DriverBid, onAccept: (bid: DriverBid, toastId: number) => void, duration = 60_000): number {
    const id = ++this.counter;
    this.toasts.update(list => [...list, {
      id,
      type: 'bid',
      title: bid.driverName,
      bid,
      onAccept,
    }]);
    setTimeout(() => this.dismiss(id), duration);
    return id;
  }

  /** Dismiss all pending bid toasts (called when a bid is accepted or request cancelled). */
  dismissAllBids() {
    this.toasts.update(list => list.filter(t => t.type !== 'bid'));
  }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}

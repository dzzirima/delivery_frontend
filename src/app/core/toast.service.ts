import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
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

  success(title: string, message?: string) {
    this.show('success', title, message);
  }

  error(title: string, message?: string) {
    this.show('error', title, message);
  }

  info(title: string, message?: string) {
    this.show('info', title, message);
  }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}

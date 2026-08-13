import { Component, inject } from '@angular/core';
import { NotificationService, NotificationItem } from '../../core/notification.service';

@Component({
  selector: 'app-notification-drawer',
  standalone: true,
  templateUrl: './notification-drawer.html',
})
export class NotificationDrawer {
  readonly notif = inject(NotificationService);

  onItemClick(item: NotificationItem): void {
    if (!item.read) {
      this.notif.markRead(item.id);
    }
  }

  /** Relative time label: "2m ago", "3h ago", "Yesterday", or date string. */
  timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);

    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return new Date(isoDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  /** Background color class for the icon bubble by notification type. */
  iconBg(type: string): string {
    if (type === 'DELIVERY_ACCEPTED' || type === 'DELIVERY_DELIVERED') return 'bg-green-100';
    if (type === 'DELIVERY_DECLINED' || type === 'DELIVERY_CANCELLED')  return 'bg-red-100';
    if (type === 'DELIVERY_IN_TRANSIT' || type === 'DELIVERY_ARRIVED')  return 'bg-blue-100';
    if (type === 'JOB_ASSIGNED')    return 'bg-indigo-100';
    if (type === 'BID_RECEIVED')    return 'bg-purple-100';
    return 'bg-gray-100';
  }

  iconColor(type: string): string {
    if (type === 'DELIVERY_ACCEPTED' || type === 'DELIVERY_DELIVERED') return 'text-green-600';
    if (type === 'DELIVERY_DECLINED' || type === 'DELIVERY_CANCELLED')  return 'text-red-500';
    if (type === 'DELIVERY_IN_TRANSIT' || type === 'DELIVERY_ARRIVED')  return 'text-blue-600';
    if (type === 'JOB_ASSIGNED')    return 'text-indigo-600';
    if (type === 'BID_RECEIVED')    return 'text-purple-600';
    return 'text-gray-500';
  }
}

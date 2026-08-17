import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, signal, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { OrgDeliveryService, DeliveryItem } from '../../org-dashboard/deliveries/deliveries.service';
import { UserService } from '../../../core/user.service';
import { ToastService } from '../../../core/toast.service';
import { DeliveryWebSocketService, RiderLocationEvent, DriverStatusEvent } from '../../../core/delivery-websocket.service';
import { environment } from '../../../../environments/environment';

const ACTIVE_STATUSES = new Set(['CREATED', 'PUBLISHED', 'ASSIGNED', 'ACCEPTED', 'DECLINED', 'IN_TRANSIT', 'ARRIVED']);

interface RiderState {
  riderId:      string;
  name:         string | null;
  deliveryId:   string | null;
  lat:          number;
  lng:          number;
  bearing:      number | null;
  status:       string | null;
  onlineStatus: 'ONLINE' | 'OFFLINE';
  lastSeenTs:   number;
}

@Component({
  selector: 'app-admin-live-ops',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterModule],
  templateUrl: './admin-live-ops.html',
})
export class AdminLiveOps implements OnInit, AfterViewInit, OnDestroy {

  // ── Deliveries ────────────────────────────────────────────────────────────────
  allDeliveries        = signal<DeliveryItem[]>([]);
  deliveryLoading      = signal(false);
  viewMode             = signal<'active' | 'past'>('active');
  deliverySearchQuery  = signal('');

  activeDeliveries = computed(() =>
    this.allDeliveries().filter(d => ACTIVE_STATUSES.has(d.status))
  );
  pastDeliveries = computed(() =>
    this.allDeliveries().filter(d => !ACTIVE_STATUSES.has(d.status))
  );
  filteredDeliveries = computed(() => {
    const base = this.viewMode() === 'active' ? this.activeDeliveries() : this.pastDeliveries();
    const q    = this.deliverySearchQuery().trim().toLowerCase();
    if (!q) return base;
    return base.filter(d =>
      (d.clientName     ?? '').toLowerCase().includes(q) ||
      (d.pickupAddress  ?? '').toLowerCase().includes(q) ||
      (d.dropoffAddress ?? '').toLowerCase().includes(q) ||
      (d.driverName     ?? '').toLowerCase().includes(q) ||
      (d.shopName       ?? '').toLowerCase().includes(q)
    );
  });

  // ── Selection ─────────────────────────────────────────────────────────────────
  selectedDeliveryId   = signal<string | null>(null);
  deliveryPanelVisible = signal(false);
  panelExpanded        = signal(false);
  selectedDelivery     = computed(() =>
    this.allDeliveries().find(d => d.id === this.selectedDeliveryId()) ?? null
  );

  setViewMode(mode: 'active' | 'past') {
    this.viewMode.set(mode);
    this.selectedDeliveryId.set(null);
    this.deliveryPanelVisible.set(false);
    this.panelExpanded.set(false);
    this.refreshMapMarkers();
  }

  // ── Live rider GPS state ──────────────────────────────────────────────────────
  private riderStates  = new Map<string, RiderState>();
  private riderMarkers = new Map<string, L.Marker>();

  selectedRiderState    = signal<RiderState | null>(null);
  selectedRiderDelivery = computed(() => {
    const rs = this.selectedRiderState();
    if (!rs?.deliveryId) return null;
    return this.allDeliveries().find(d => d.id === rs.deliveryId) ?? null;
  });

  dismissRiderPanel() { this.selectedRiderState.set(null); }

  // ── Actions ───────────────────────────────────────────────────────────────────
  cancelling         = signal(false);
  publishing         = signal(false);
  showCancelConfirm  = signal(false);
  showPublishConfirm = signal(false);

  canCancelSelected = computed(() => {
    const d = this.selectedDelivery();
    return d ? !['DELIVERED', 'CANCELLED', 'FAILED', 'IN_TRANSIT'].includes(d.status) : false;
  });
  canPublishSelected = computed(() => {
    const d = this.selectedDelivery();
    return d ? ['ASSIGNED', 'DECLINED'].includes(d.status) : false;
  });

  confirmCancel() {
    const d = this.selectedDelivery();
    if (!d) return;
    this.showCancelConfirm.set(false);
    this.cancelling.set(true);
    this.deliveryService.cancel(d.id).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.toast.success('Cancelled', 'Delivery has been cancelled.');
        this.loadDeliveries();
        this.selectedDeliveryId.set(null);
        this.deliveryPanelVisible.set(false);
      },
      error: e => {
        this.cancelling.set(false);
        this.toast.error('Error', e?.error?.message ?? 'Failed to cancel delivery.');
      },
    });
  }

  confirmPublish() {
    const d = this.selectedDelivery();
    if (!d) return;
    this.showPublishConfirm.set(false);
    this.publishing.set(true);
    this.deliveryService.publish(d.id).subscribe({
      next: () => {
        this.publishing.set(false);
        this.toast.success('Published', 'Delivery published to open bidding.');
        this.loadDeliveries();
      },
      error: e => {
        this.publishing.set(false);
        this.toast.error('Error', e?.error?.message ?? 'Failed to publish delivery.');
      },
    });
  }

  // ── ETA ───────────────────────────────────────────────────────────────────────
  selectedDeliveryEta = signal<{
    mins: number; distKm: number; label: string;
    routeMins?: number; routeDistKm?: number;
  } | null>(null);

  // ── Map ───────────────────────────────────────────────────────────────────────
  @ViewChild('liveOpsMap') mapEl?: ElementRef;
  private map:              L.Map | null = null;
  private mapLayers:        L.Layer[]    = [];
  private routeLayers:      L.Layer[]    = [];
  private deliveryMarkers   = new Map<string, { pickup?: L.Marker; dropoff?: L.Marker }>();
  private mapResizeObserver: ResizeObserver | null = null;
  private osrmCache         = new Map<string, L.LatLng[]>();

  // ── Utility ───────────────────────────────────────────────────────────────────
  statusColour(status: string): string {
    const p: Record<string, string> = {
      CREATED: '#f97316', PUBLISHED: '#f97316', ASSIGNED: '#f59e0b',
      ACCEPTED: '#3b82f6', IN_TRANSIT: '#8b5cf6', ARRIVED: '#10b981',
      DECLINED: '#ef4444', DELIVERED: '#16a34a', CANCELLED: '#ef4444',
    };
    return p[status] ?? '#6b7280';
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  timeElapsed(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  private haversineM(a: L.LatLng, b: L.LatLng): number {
    const R = 6_371_000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  private bearingDeg(a: L.LatLng, b: L.LatLng): number {
    const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  private makeChevronIcon(colour: string, bearing: number): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<svg width="14" height="14" viewBox="0 0 14 14"
                  style="transform:rotate(${bearing}deg);display:block;overflow:visible"
                  xmlns="http://www.w3.org/2000/svg">
               <path d="M2.1 9.8L7 3.5L11.9 9.8" fill="none"
                     stroke="${colour}" stroke-width="4.9"
                     stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>
               <path d="M2.1 9.8L7 3.5L11.9 9.8" fill="none"
                     stroke="white" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round"/>
             </svg>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
  }

  private placeChevrons(path: L.LatLng[], colour: string) {
    if (!this.map || path.length < 2) return;
    let accumulated = 40;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const segDist = this.haversineM(a, b);
      const bearing = this.bearingDeg(a, b);
      while (accumulated <= segDist) {
        const t  = accumulated / segDist;
        const pt = L.latLng(a.lat + t * (b.lat - a.lat), a.lng + t * (b.lng - a.lng));
        const m  = L.marker(pt, { icon: this.makeChevronIcon(colour, bearing), interactive: false });
        m.addTo(this.map!);
        this.routeLayers.push(m);
        accumulated += 80;
      }
      accumulated -= segDist;
    }
  }

  private async fetchOsrmSegment(
    fromLat: number, fromLng: number, toLat: number, toLng: number,
  ): Promise<{ path: L.LatLng[]; durationSecs: number; distanceM: number }> {
    const url = `${environment.apiUrl}/location/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`;
    const res  = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('tih_token') ?? ''}` },
    });
    const json = await res.json();
    const route = json.data;
    const coords: [number, number][] = route.coordinates;
    return {
      path:         coords.map(([lng, lat]) => L.latLng(lat, lng)),
      durationSecs: route.durationSecs as number,
      distanceM:    route.distanceM    as number,
    };
  }

  private straightPath(lat1: number, lng1: number, lat2: number, lng2: number): L.LatLng[] {
    return [L.latLng(lat1, lng1), L.latLng(lat2, lng2)];
  }

  private drawSegment(
    path: L.LatLng[], colour: string,
    opts: { dashed?: boolean; weight?: number; noChevrons?: boolean },
  ) {
    if (!this.map) return;
    const line = L.polyline(path, {
      color: colour, weight: opts.weight ?? 4, opacity: 0.85,
      dashArray: opts.dashed ? '10 6' : undefined,
    }).addTo(this.map!);
    this.routeLayers.push(line);
    if (!opts.noChevrons) this.placeChevrons(path, colour);
  }

  private async drawSelectedDeliveryRoute(d: DeliveryItem) {
    if (!this.map || !d.pickupLat || !d.pickupLng || !d.dropoffLat || !d.dropoffLng) return;
    const pLat = d.pickupLat, pLng = d.pickupLng;
    const drLat = d.dropoffLat, drLng = d.dropoffLng;
    const riderState = d.driverId
      ? [...this.riderStates.values()].find(rs => rs.deliveryId === d.id || rs.riderId === d.driverId)
      : null;
    const hasRider    = !!(riderState?.lat && riderState?.lng);
    const isEnRoute   = ['ASSIGNED', 'ACCEPTED'].includes(d.status);
    const isInTransit = ['IN_TRANSIT', 'ARRIVED'].includes(d.status);
    const isTerminal  = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status);

    this.routeLayers.forEach(l => l.remove());
    this.routeLayers = [];

    if (hasRider && isEnRoute) {
      this.drawSegment(this.straightPath(riderState!.lat, riderState!.lng, pLat, pLng), '#f59e0b', { dashed: true, noChevrons: true });
      this.drawSegment(this.straightPath(pLat, pLng, drLat, drLng), '#3b82f6', { dashed: true, noChevrons: true });
    } else if (hasRider && isInTransit) {
      this.drawSegment(this.straightPath(riderState!.lat, riderState!.lng, drLat, drLng), '#8b5cf6', { dashed: true, noChevrons: true });
    } else {
      this.drawSegment(this.straightPath(pLat, pLng, drLat, drLng), isTerminal ? '#6b7280' : '#3b82f6', { dashed: true, weight: 3, noChevrons: true });
    }

    try {
      if (hasRider && isEnRoute) {
        const [riderLeg, routeLeg] = await Promise.all([
          this.fetchOsrmSegment(riderState!.lat, riderState!.lng, pLat, pLng),
          this.fetchOsrmSegment(pLat, pLng, drLat, drLng).then(r => { this.osrmCache.set(d.id, r.path); return r; }),
        ]);
        if (this.selectedDeliveryId() !== d.id || !this.map) return;
        this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];
        this.drawSegment(riderLeg.path, '#f59e0b', { dashed: true });
        this.drawSegment(routeLeg.path, '#3b82f6', {});
        this.selectedDeliveryEta.set({
          mins: Math.max(1, Math.round(riderLeg.durationSecs / 60)), distKm: riderLeg.distanceM / 1000,
          label: 'to pickup', routeMins: Math.max(1, Math.round(routeLeg.durationSecs / 60)), routeDistKm: routeLeg.distanceM / 1000,
        });
      } else if (hasRider && isInTransit) {
        const leg = await this.fetchOsrmSegment(riderState!.lat, riderState!.lng, drLat, drLng);
        if (this.selectedDeliveryId() !== d.id || !this.map) return;
        this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];
        this.drawSegment(leg.path, '#8b5cf6', {});
        this.selectedDeliveryEta.set({ mins: Math.max(1, Math.round(leg.durationSecs / 60)), distKm: leg.distanceM / 1000, label: 'to dropoff' });
      } else if (!isTerminal) {
        const seg = await this.fetchOsrmSegment(pLat, pLng, drLat, drLng);
        this.osrmCache.set(d.id, seg.path);
        if (this.selectedDeliveryId() !== d.id || !this.map) return;
        this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];
        this.drawSegment(seg.path, '#3b82f6', {});
        this.selectedDeliveryEta.set({ mins: Math.max(1, Math.round(seg.durationSecs / 60)), distKm: seg.distanceM / 1000, label: 'delivery route' });
      }
    } catch { /* keep placeholder */ }
  }

  // ── Pin factories ─────────────────────────────────────────────────────────────
  private makePickupPin(selected = false): L.Icon {
    const w = selected ? 40 : 28, h = selected ? 53 : 37;
    return L.icon({ iconUrl: '/icons/pickup.svg', iconSize: [w, h], iconAnchor: [w / 2, h], popupAnchor: [0, -h] });
  }

  private makeDropoffPin(selected = false): L.Icon {
    const w = selected ? 40 : 28, h = selected ? 53 : 37;
    return L.icon({ iconUrl: '/icons/dropoff.svg', iconSize: [w, h], iconAnchor: [w / 2, h], popupAnchor: [0, -h] });
  }

  private makeRiderPin(bearing: number | null, ghost = false, offline = false, idle = false): L.DivIcon {
    const rotation = bearing != null ? bearing - 90 : 0;
    const w = 58, h = 52, ax = 26, ay = 26;
    let filter = '';
    if (ghost)        filter = 'grayscale(100%) opacity(0.4)';
    else if (offline) filter = 'hue-rotate(139deg) saturate(1.5) brightness(0.9)';
    else if (idle)    filter = 'hue-rotate(259deg) saturate(1.3)';
    const imgStyle = [
      'display:block', `transform:rotate(${rotation}deg)`,
      `transform-origin:${ax}px ${ay}px`,
      filter ? `filter:${filter}` : '',
    ].filter(Boolean).join(';');
    return L.divIcon({
      className: '',
      html: `<img src="/icons/bike.svg" width="${w}" height="${h}" style="${imgStyle}" draggable="false"/>`,
      iconSize: [w, h], iconAnchor: [ax, ay],
    });
  }

  private lastSeenLabel(ts: number): string {
    if (!ts) return 'Never';
    const mins = Math.floor((Date.now() - ts) / 60_000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
  }

  selectedRiderOffline(): boolean {
    const d = this.selectedDelivery();
    if (!d?.driverId) return false;
    const rs = [...this.riderStates.values()].find(r => r.riderId === d.driverId || r.deliveryId === d.id);
    return rs?.onlineStatus === 'OFFLINE' && rs.lat != null && rs.lng != null;
  }

  selectedRiderLastSeen(): string {
    const d = this.selectedDelivery();
    if (!d?.driverId) return '';
    const rs = [...this.riderStates.values()].find(r => r.riderId === d.driverId || r.deliveryId === d.id);
    return rs?.lastSeenTs ? this.lastSeenLabel(rs.lastSeenTs) : '';
  }

  // ── Map lifecycle ─────────────────────────────────────────────────────────────
  initMap() {
    if (!this.mapEl?.nativeElement || this.map) return;
    this.map = L.map(this.mapEl.nativeElement, { center: [-17.8292, 31.0522], zoom: 12, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(this.map);
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.refreshMapMarkers();
    this.mapResizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.mapResizeObserver.observe(this.mapEl!.nativeElement);
  }

  refreshMapMarkers() {
    if (!this.map) return;
    this.mapLayers.forEach(l => l.remove()); this.mapLayers = [];
    this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];
    this.deliveryMarkers.clear();
    const selId = this.selectedDeliveryId();
    const selectedPast = selId ? this.allDeliveries().find(d => d.id === selId && !ACTIVE_STATUSES.has(d.status)) : undefined;
    const deliveriesToPin = selectedPast ? [...this.activeDeliveries(), selectedPast] : this.activeDeliveries();

    let selectedDelivery: DeliveryItem | undefined;
    for (const d of deliveriesToPin) {
      const sel   = d.id === selId;
      const entry: { pickup?: L.Marker; dropoff?: L.Marker } = {};
      if (sel) selectedDelivery = d;
      if (d.pickupLat && d.pickupLng) {
        const m = L.marker([d.pickupLat, d.pickupLng], { icon: this.makePickupPin(sel), zIndexOffset: sel ? 1000 : 0 })
          .bindPopup(this.makePopupHtml(d, 'pickup')).addTo(this.map!);
        entry.pickup = m; this.mapLayers.push(m);
      }
      if (d.dropoffLat && d.dropoffLng) {
        const m = L.marker([d.dropoffLat, d.dropoffLng], { icon: this.makeDropoffPin(sel), zIndexOffset: sel ? 1000 : 0 })
          .bindPopup(this.makePopupHtml(d, 'dropoff')).addTo(this.map!);
        entry.dropoff = m; this.mapLayers.push(m);
      }
      this.deliveryMarkers.set(d.id, entry);
    }
    if (selectedDelivery) this.drawSelectedDeliveryRoute(selectedDelivery);
    else this.selectedDeliveryEta.set(null);
    this.refreshRiderMarkers();
  }

  private refreshRiderMarkers() {
    if (!this.map) return;
    this.riderMarkers.forEach(m => m.remove()); this.riderMarkers.clear();
    const selDelivery = this.allDeliveries().find(d => d.id === this.selectedDeliveryId());
    const selRiderId  = selDelivery?.driverId ?? null;
    let selectedRiderSeen = false;

    for (const rs of this.riderStates.values()) {
      if (!rs.lat || !rs.lng) continue;
      const delivery  = this.allDeliveries().find(d => d.id === rs.deliveryId);
      const isSel     = rs.riderId === selRiderId || rs.deliveryId === this.selectedDeliveryId();
      const isOffline = rs.onlineStatus === 'OFFLINE';
      const isIdle    = !isOffline && !rs.deliveryId;
      if (isSel) selectedRiderSeen = true;

      const icon   = this.makeRiderPin(rs.bearing, false, isOffline, isIdle);
      const marker = L.marker([rs.lat, rs.lng], { icon, zIndexOffset: isOffline ? 500 : 2000 });
      const riderName   = rs.name ?? delivery?.driverName ?? 'Rider';
      const statusText  = isOffline ? 'Offline' : isIdle ? 'Online' : 'On delivery';
      const statusColor = isOffline ? '#ef4444' : isIdle ? '#16a34a' : '#3b82f6';
      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:140px;padding:2px 0">
          <b style="font-size:13px">${riderName}</b>
          <div style="font-size:11px;font-weight:600;color:${statusColor};margin-top:4px">${statusText}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${rs.lastSeenTs ? `Last seen: ${this.lastSeenLabel(rs.lastSeenTs)}` : 'No GPS data'}</div>
        </div>`, { closeButton: false, autoPan: false });
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout',  () => marker.closePopup());
      marker.on('click', () => {
        this.selectedRiderState.set(rs);
        this.selectedDeliveryId.set(null);
        this.refreshMapMarkers();
      });
      marker.addTo(this.map!);
      this.riderMarkers.set(rs.riderId, marker);
    }

    if (selDelivery?.driverId && !selectedRiderSeen && selDelivery.pickupLat && selDelivery.pickupLng) {
      const ghost = L.marker([selDelivery.pickupLat, selDelivery.pickupLng], {
        icon: this.makeRiderPin(null, true), zIndexOffset: 2500,
      }).bindPopup(`
        <div style="font-family:system-ui;min-width:150px;padding:2px 0">
          <b style="font-size:13px">${selDelivery.driverName ?? 'Rider'}</b>
          <div style="font-size:11px;color:#f59e0b;margin-top:3px;font-weight:600">⚠ Position not yet available</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Awaiting first GPS signal</div>
        </div>`);
      ghost.addTo(this.map!);
      this.riderMarkers.set('__ghost__' + selDelivery.driverId, ghost as unknown as L.Marker);
    }
  }

  private makePopupHtml(d: DeliveryItem, type: 'pickup' | 'dropoff'): string {
    const addr   = type === 'pickup' ? d.pickupAddress : d.dropoffAddress;
    const colour = type === 'pickup' ? '#22c55e' : '#ef4444';
    return `<div style="font-family:system-ui;min-width:160px;padding:2px 0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="width:8px;height:8px;border-radius:50%;background:${colour};display:inline-block;flex-shrink:0"></span>
        <b style="font-size:13px">${d.clientName ?? 'Dispatch'}</b>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:2px">${type === 'pickup' ? '↑ Pickup' : '↓ Dropoff'}</div>
      <div style="font-size:12px;color:#111827;line-height:1.4">${addr}</div>
      ${d.shopName ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">Shop: ${d.shopName}</div>` : ''}
      ${d.driverName ? `<div style="font-size:11px;color:#16a34a;margin-top:4px">Rider: ${d.driverName}</div>` : ''}
      <div style="font-size:11px;color:#6b7280;margin-top:2px">$${d.price.toFixed(2)}</div>
    </div>`;
  }

  focusDelivery(item: DeliveryItem) {
    const isSame    = this.selectedDeliveryId() === item.id;
    const panelOpen = this.deliveryPanelVisible();
    if (isSame && panelOpen) { this.deliveryPanelVisible.set(false); this.panelExpanded.set(false); return; }
    if (isSame && !panelOpen) { this.deliveryPanelVisible.set(true); this.panelExpanded.set(false); return; }

    this.selectedDeliveryId.set(item.id);
    this.deliveryPanelVisible.set(true);
    this.panelExpanded.set(false);
    this.selectedRiderState.set(null);
    this.refreshMapMarkers();

    if (!this.map) return;
    const riderState = item.driverId
      ? [...this.riderStates.values()].find(rs => rs.deliveryId === item.id || rs.riderId === item.driverId)
      : null;
    const pts: L.LatLngExpression[] = [];
    if (riderState?.lat && riderState?.lng) pts.push([riderState.lat, riderState.lng]);
    if (item.pickupLat  && item.pickupLng)  pts.push([item.pickupLat,  item.pickupLng]);
    if (item.dropoffLat && item.dropoffLng) pts.push([item.dropoffLat, item.dropoffLng]);
    if (pts.length >= 2) this.map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15, animate: true, duration: 0.8 });
    else if (pts.length === 1) this.map.flyTo(pts[0], 15, { duration: 0.8 });
  }

  loadDeliveries() {
    this.deliveryLoading.set(true);
    this.deliveryService.getBoard().subscribe({
      next: r => {
        this.allDeliveries.set(Array.isArray(r.data) ? r.data : []);
        this.refreshMapMarkers();
        this.deliveryLoading.set(false);
      },
      error: () => this.deliveryLoading.set(false),
    });
  }

  loadRiderSnapshot() {
    this.userService.getAllDriverLocations().subscribe({
      next: r => {
        for (const d of (r.data ?? [])) {
          if (!d.latitude || !d.longitude) continue;
          if (this.riderStates.has(d.driverId)) continue;
          this.riderStates.set(d.driverId, {
            riderId:      d.driverId,
            name:         d.driverName,
            deliveryId:   d.deliveryId,
            lat:          d.latitude,
            lng:          d.longitude,
            bearing:      null, status: null,
            onlineStatus: d.online ? 'ONLINE' : 'OFFLINE',
            lastSeenTs:   d.lastSeenTs,
          });
        }
        this.refreshRiderMarkers();
      },
      error: () => {},
    });
  }

  destroyMap() {
    this.mapResizeObserver?.disconnect(); this.mapResizeObserver = null;
    this.routeLayers.forEach(l => l.remove()); this.routeLayers = [];
    if (this.map) { this.map.remove(); this.map = null; }
    this.mapLayers = [];
    this.deliveryMarkers.clear();
    this.riderMarkers.forEach(m => m.remove()); this.riderMarkers.clear();
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────────
  private boardSub:           Subscription | null = null;
  private locationSub:        Subscription | null = null;
  private driverStatusSub:    Subscription | null = null;
  private routeRedrawTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private deliveryService: OrgDeliveryService,
    private userService:     UserService,
    private toast:           ToastService,
    private ws:              DeliveryWebSocketService,
  ) {}

  ngOnInit() {
    this.loadDeliveries();
    this.loadRiderSnapshot();

    this.boardSub = this.ws.boardEvents$.subscribe(evt => {
      const data      = evt.data as Record<string, unknown>;
      const evtId     = String(data['id'] ?? data['deliveryId'] ?? '');
      const newStatus = String(data['status'] ?? '');
      if (evtId) {
        this.allDeliveries.update(list => {
          const idx = list.findIndex(d => d.id === evtId);
          if (idx < 0) return list;
          const updated = { ...list[idx] };
          if (newStatus)          updated.status     = newStatus;
          if (data['driverName']) updated.driverName = String(data['driverName']);
          if (data['driverId'])   updated.driverId   = String(data['driverId']);
          const next = [...list]; next[idx] = updated; return next;
        });
        this.refreshMapMarkers();
      }
    });

    this.locationSub = this.ws.riderLocations$.subscribe((evt: RiderLocationEvent) => {
      if (!evt.riderId || !evt.lat || !evt.lng) return;
      const wasTracked = this.riderStates.has(evt.riderId);
      const existing   = this.riderStates.get(evt.riderId);
      this.riderStates.set(evt.riderId, {
        riderId:      evt.riderId,
        name:         existing?.name       ?? null,
        deliveryId:   evt.deliveryId       ?? existing?.deliveryId ?? null,
        lat:          evt.lat, lng:        evt.lng,
        bearing:      evt.bearing          ?? existing?.bearing    ?? null,
        status:       evt.status           ?? existing?.status     ?? null,
        onlineStatus: 'ONLINE', lastSeenTs: Date.now(),
      });
      this.refreshRiderMarkers();
      const sel        = this.selectedDelivery();
      const isSelRider = sel && (sel.driverId === evt.riderId || evt.deliveryId === sel.id);
      if (isSelRider) {
        if (!wasTracked) { this.drawSelectedDeliveryRoute(sel!); }
        else {
          if (this.routeRedrawTimeout) clearTimeout(this.routeRedrawTimeout);
          this.routeRedrawTimeout = setTimeout(() => {
            const current = this.selectedDelivery();
            if (current) this.drawSelectedDeliveryRoute(current);
            this.routeRedrawTimeout = null;
          }, 30_000);
        }
      }
    });

    this.driverStatusSub = this.ws.driverStatus$.subscribe((evt: DriverStatusEvent) => {
      if (!evt.riderId) return;
      const existing = this.riderStates.get(evt.riderId);
      if (evt.status === 'OFFLINE') {
        if (existing) {
          this.riderStates.set(evt.riderId, {
            ...existing, onlineStatus: 'OFFLINE',
            lastSeenTs: evt.lastSeenTs || existing.lastSeenTs,
            lat: evt.lat ?? existing.lat, lng: evt.lng ?? existing.lng,
          });
        } else if (evt.lat && evt.lng) {
          this.riderStates.set(evt.riderId, {
            riderId: evt.riderId, name: evt.riderName, deliveryId: evt.deliveryId,
            lat: evt.lat, lng: evt.lng, bearing: null, status: null,
            onlineStatus: 'OFFLINE', lastSeenTs: evt.lastSeenTs,
          });
        }
      } else {
        this.riderStates.set(evt.riderId, {
          riderId:      evt.riderId,
          name:         evt.riderName ?? existing?.name ?? null,
          deliveryId:   evt.deliveryId ?? existing?.deliveryId ?? null,
          lat:          evt.lat ?? existing?.lat ?? 0,
          lng:          evt.lng ?? existing?.lng ?? 0,
          bearing:      existing?.bearing ?? null, status: existing?.status ?? null,
          onlineStatus: 'ONLINE', lastSeenTs: evt.lastSeenTs || existing?.lastSeenTs || Date.now(),
        });
      }
      this.refreshRiderMarkers();
    });
  }

  ngAfterViewInit() { setTimeout(() => this.initMap(), 0); }

  ngOnDestroy() {
    this.boardSub?.unsubscribe();
    this.locationSub?.unsubscribe();
    this.driverStatusSub?.unsubscribe();
    if (this.routeRedrawTimeout) clearTimeout(this.routeRedrawTimeout);
    this.destroyMap();
  }
}

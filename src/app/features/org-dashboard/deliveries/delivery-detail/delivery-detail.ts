import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, TitleCasePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import { OrgDeliveryService, DeliveryDetail as DeliveryDetailData } from '../deliveries.service';
import { UserService } from '../../../../core/user.service';

@Component({
  selector: 'app-delivery-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, CurrencyPipe, DecimalPipe],
  templateUrl: './delivery-detail.html',
})
export class DeliveryDetail implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('detailMap') mapEl?: ElementRef;

  readonly orgId = computed(() => this.userService.profile()?.organisationId ?? null);

  delivery = signal<DeliveryDetailData | null>(null);
  loading  = signal(true);
  error    = signal('');

  private map: L.Map | null = null;

  constructor(
    private route:        ActivatedRoute,
    private router:       Router,
    private service:      OrgDeliveryService,
    private userService:  UserService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;

    this.service.getDetail(id).subscribe({
      next: r => {
        this.delivery.set(r.data);
        this.loading.set(false);
        // Map div is always rendered — place pins directly if map is ready,
        // otherwise initMap() will pick up delivery() at the end of its own init
        if (this.map) this.placePins(r.data);
      },
      error: e => {
        this.error.set(e?.error?.message ?? 'Failed to load delivery.');
        this.loading.set(false);
      },
    });
  }

  ngAfterViewInit() {
    // Map div is always in DOM — safe to init immediately after view renders
    setTimeout(() => this.initMap(), 0);
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
  }

  private initMap() {
    if (!this.mapEl?.nativeElement || this.map) return;
    this.map = L.map(this.mapEl.nativeElement, {
      center: [-17.8292, 31.0522],
      zoom: 12,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    // Data may have loaded before the map was ready
    const d = this.delivery();
    if (d) this.placePins(d);
  }

  private placePins(d: DeliveryDetailData) {
    if (!this.map) return;

    const pickupIcon = L.divIcon({
      className: '',
      html: `<div style="background:#22c55e;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #22c55e,0 2px 6px rgba(0,0,0,.4)"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const dropoffIcon = L.divIcon({
      className: '',
      html: `<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #ef4444,0 2px 6px rgba(0,0,0,.4)"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });

    const pts: L.LatLngExpression[] = [];

    if (d.route.pickupLat && d.route.pickupLng) {
      const pt: L.LatLngExpression = [d.route.pickupLat, d.route.pickupLng];
      L.marker(pt, { icon: pickupIcon })
        .bindPopup(`<b>Pickup</b><br><span style="font-size:12px">${d.route.pickupAddress}</span>`)
        .addTo(this.map!);
      pts.push(pt);
    }

    if (d.route.dropoffLat && d.route.dropoffLng) {
      const pt: L.LatLngExpression = [d.route.dropoffLat, d.route.dropoffLng];
      L.marker(pt, { icon: dropoffIcon })
        .bindPopup(`<b>Dropoff</b><br><span style="font-size:12px">${d.route.dropoffAddress}</span>`)
        .addTo(this.map!);
      pts.push(pt);
    }

    if (pts.length === 2) {
      this.map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15, animate: false });
    } else if (pts.length === 1) {
      this.map.setView(pts[0], 14);
    }
  }

  statusColor(status: string): string {
    const map: Record<string, string> = {
      ASSIGNED: '#f59e0b', ACCEPTED: '#3b82f6', IN_TRANSIT: '#8b5cf6',
      ARRIVED: '#06b6d4', DELIVERED: '#22c55e', DECLINED: '#ef4444',
      PUBLISHED: '#f97316', CANCELLED: '#6b7280',
    };
    return map[status] ?? '#6b7280';
  }

  goBack() {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}

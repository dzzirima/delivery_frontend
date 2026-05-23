import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface PlaceResult {
  address: string;
  lat: number | null;
  lng: number | null;
}

declare const google: any;

@Directive({
  selector: '[appGooglePlaces]',
  standalone: true,
})
export class GooglePlacesDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLInputElement>);

  @Output() placeSelected = new EventEmitter<PlaceResult>();

  private autocomplete: any;
  private listener: any;

  ngOnInit() {
    this.loadScript().then(() => this.initAutocomplete());
  }

  ngOnDestroy() {
    if (this.listener && typeof google !== 'undefined') {
      google.maps.event.removeListener(this.listener);
    }
  }

  private loadScript(): Promise<void> {
    return new Promise(resolve => {
      if (typeof google !== 'undefined' && google?.maps?.places) {
        resolve();
        return;
      }
      const existing = document.getElementById('google-maps-script');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private initAutocomplete() {
    this.autocomplete = new google.maps.places.Autocomplete(this.el.nativeElement, {
      fields: ['formatted_address', 'geometry'],
    });
    this.listener = this.autocomplete.addListener('place_changed', () => {
      const place = this.autocomplete.getPlace();
      this.placeSelected.emit({
        address: place.formatted_address ?? (this.el.nativeElement as HTMLInputElement).value,
        lat: place.geometry?.location?.lat() ?? null,
        lng: place.geometry?.location?.lng() ?? null,
      });
    });
  }
}

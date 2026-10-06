import { CurrencyPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnChanges, OnDestroy, Input, ViewChild, inject, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Map, Marker } from 'maplibre-gl';
import { PublicThemeService } from '../../../services/public-theme.service';
import { ListingPreview } from '../../models/public-listing';
import { MapLoaderService, MAP_STYLES } from './map-loader.service';
import { mapStyleOptions } from './map-style';

export function mappableListings(listings: ListingPreview[]): ListingPreview[] {
  return listings.filter(l => !l.hide_exact_address && typeof l.latitude === 'number' && typeof l.longitude === 'number'
    && Number.isFinite(l.latitude) && Number.isFinite(l.longitude) && Math.abs(l.latitude) <= 90 && Math.abs(l.longitude) <= 180);
}

@Component({
  selector: 'app-listing-map',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './listing-map.component.html',
  styleUrl: './listing-map.component.css',
})
export class ListingMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() listings: ListingPreview[] = [];
  @Input() detail = false;
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLDivElement>;
  private readonly loader = inject(MapLoaderService);
  private readonly theme = inject(PublicThemeService);
  private map?: Map;
  private library?: typeof import('maplibre-gl');
  private markers: Marker[] = [];
  private observer?: ResizeObserver;
  private ready = false;
  private destroyed = false;
  private starting = false;
  loading = false;
  error = false;
  selected: ListingPreview | null = null;
  get mapped(): ListingPreview[] { return mappableListings(this.listings); }

  constructor() {
    effect(() => { const theme = this.theme.theme(); this.map?.setStyle(MAP_STYLES[theme], mapStyleOptions(theme)); });
  }
  ngAfterViewInit(): void {
    this.ready = true;
    void Promise.resolve().then(() => { if (!this.destroyed) void this.update(); });
  }
  ngOnChanges(): void { if (this.ready) void this.update(); }
  async update(): Promise<void> {
    this.selected = this.mapped.find(l => l.id === this.selected?.id) ?? null;
    if (!this.mapped.length) {
      this.markers.forEach(m => m.remove()); this.markers = [];
      return;
    }
    if (!this.map) {
      if (this.starting) return;
      this.starting = this.loading = true;
      this.error = false;
      try {
        this.library = await this.loader.load();
        if (this.destroyed || !this.mapped.length) return;
        this.map = new this.library.Map({ container: this.canvas.nativeElement,
          center: [this.mapped[0].longitude!, this.mapped[0].latitude!], zoom: 12, attributionControl: {} });
        this.map.getCanvas().setAttribute('aria-label', 'Interactive map of listing locations. Use the listing links for property information.');
        this.map.addControl(new this.library.NavigationControl({ showCompass: false }), 'top-right');
        this.map.on('error', () => { this.error = true; });
        this.map.on('load', () => { this.loading = false; });
        this.map.setStyle(MAP_STYLES[this.theme.theme()], mapStyleOptions(this.theme.theme()));
        this.observer = new ResizeObserver(() => this.map?.resize());
        this.observer.observe(this.canvas.nativeElement);
      } catch { this.error = true; this.loading = false; }
      finally { this.starting = false; if (!this.map) this.loading = false; }
    }
    if (!this.map || !this.library) return;
    this.markers.forEach(m => m.remove());
    const bounds = new this.library.LngLatBounds();
    this.markers = this.mapped.map((listing, index) => {
      const point: [number, number] = [listing.longitude!, listing.latitude!];
      bounds.extend(point);
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = String(index + 1);
      button.setAttribute('aria-label', `Select ${listing.title}, ${listing.city}`);
      button.style.cssText = 'width:44px;height:44px;border-radius:50%;background:#181633;color:#f3f3fa;border:3px solid #b4dbbc;font-weight:bold;cursor:pointer';
      button.addEventListener('click', () => { this.selected = listing; });
      return new this.library!.Marker({ element: button }).setLngLat(point).addTo(this.map!);
    });
    this.map.resize();
    this.map.fitBounds(bounds, { padding: 55, maxZoom: 14, duration: 0 });
  }
  retry(): void {
    this.map?.remove(); this.map = undefined; this.observer?.disconnect();
    void this.update();
  }
  ngOnDestroy(): void {
    this.destroyed = true; this.observer?.disconnect();
    this.markers.forEach(m => m.remove()); this.map?.remove();
  }
}

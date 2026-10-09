import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ListingMapComponent, mappableListings } from './listing-map.component';
import { MapLoaderService, MAP_STYLES } from './map-loader.service';
import { PublicThemeService } from '../../../services/public-theme.service';
import { ListingPreview } from '../../models/public-listing';

const home = { id: 1, title: 'Ames home', city: 'Ames', price: 300000, status: 'Active', latitude: 42.03, longitude: -93.63, hide_exact_address: false } as ListingPreview;

describe('On-demand public listing map', () => {
  let fixture: ComponentFixture<ListingMapComponent>;
  let loader: jasmine.Spy;
  let options: any;
  let map: any;
  let markers: any[];
  beforeEach(async () => {
    markers = [];
    map = { getCanvas: () => document.createElement('canvas'), addControl: jasmine.createSpy(), on: jasmine.createSpy(), resize: jasmine.createSpy(), fitBounds: jasmine.createSpy(), setStyle: jasmine.createSpy(), remove: jasmine.createSpy() };
    class FakeMap { constructor(value: any) { options = value; return map; } }
    class FakeMarker {
      remove = jasmine.createSpy();
      element: HTMLElement;
      constructor(readonly options: any) { this.element = options.element ?? document.createElement('div'); markers.push(this); }
      getElement() { return this.element; }
      setLngLat = jasmine.createSpy().and.returnValue(this);
      addTo = jasmine.createSpy().and.returnValue(this);
    }
    class FakeBounds { extend() { return this; } }
    loader = jasmine.createSpy().and.resolveTo({ Map: FakeMap, Marker: FakeMarker, NavigationControl: class {}, LngLatBounds: FakeBounds });
    await TestBed.configureTestingModule({ imports: [ListingMapComponent], providers: [provideRouter([]), { provide: MapLoaderService, useValue: { load: loader } }] }).compileComponents();
    fixture = TestBed.createComponent(ListingMapComponent);
  });
  it('omits missing, private and invalid coordinates while retaining zero coordinates', () => {
    expect(mappableListings([home, { ...home, latitude: null }, { ...home, hide_exact_address: true }, { ...home, longitude: Infinity }, { ...home, latitude: 0, longitude: 0 }]).length).toBe(2);
  });
  it('does not load the renderer for missing or private coordinates', () => {
    fixture.componentRef.setInput('listings', [{ ...home, hide_exact_address: true }]);
    fixture.componentRef.setInput('detail', true);
    fixture.detectChanges();
    expect(loader).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('withheld for privacy');
  });
  it('maps only current results, fits bounds, identifies a marker and links to its detail', async () => {
    fixture.componentRef.setInput('listings', [home, { ...home, id: 2, latitude: null }]);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(markers.length).toBe(1);
    expect(markers[0].element.textContent).toBe('1');
    expect(fixture.nativeElement.textContent).toContain('Select a numbered marker or a listing link below.');
    expect(map.fitBounds).toHaveBeenCalled();
    markers[0].options.element.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.listing-map__selection a').getAttribute('href')).toBe('/listings/1');
    fixture.componentRef.setInput('listings', [{ ...home, id: 3 }]); fixture.detectChanges(); await fixture.whenStable();
    expect(markers[0].remove).toHaveBeenCalled();
    expect(fixture.componentInstance.selected).toBeNull();
    fixture.destroy(); expect(map.remove).toHaveBeenCalled();
  });
  it('uses a single-location pin and concise copy without result-selection UI on details', async () => {
    fixture.componentRef.setInput('listings', [home]);
    fixture.componentRef.setInput('detail', true);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(markers.length).toBe(1);
    expect(markers[0].options.element).toBeUndefined();
    expect(markers[0].element.getAttribute('role')).toBe('img');
    expect(markers[0].element.getAttribute('aria-label')).toBe('Approximate location of Ames home, Ames');
    expect(markers[0].setLngLat).toHaveBeenCalledWith([-93.63, 42.03]);
    expect(fixture.nativeElement.textContent).toContain('Approximate location shown for this fictional demo listing.');
    expect(fixture.nativeElement.textContent).not.toContain('mapped home');
    expect(fixture.nativeElement.textContent).not.toContain('Select a numbered marker');
    expect(fixture.nativeElement.querySelector('ol')).toBeNull();
    markers[0].element.click(); fixture.detectChanges();
    expect(fixture.componentInstance.selected).toBeNull();
    expect(fixture.nativeElement.querySelector('.listing-map__selection')).toBeNull();
  });
  it('updates the style when the public theme changes without resetting bounds', async () => {
    fixture.componentRef.setInput('listings', [home]); fixture.detectChanges(); await fixture.whenStable();
    const count = map.fitBounds.calls.count();
    const theme = TestBed.inject(PublicThemeService);
    theme.toggle(); fixture.detectChanges();
    expect(map.setStyle).toHaveBeenCalledWith(MAP_STYLES[theme.theme()], jasmine.any(Object));
    expect(map.fitBounds.calls.count()).toBe(count);
  });
  it('preserves the historical Sold price label in marker selection', async () => {
    fixture.componentRef.setInput('listings', [{ ...home, status: 'Sold' }]); fixture.detectChanges(); await fixture.whenStable();
    markers[0].options.element.click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Last listed at $300,000');
  });
  it('shows a recoverable renderer failure instead of losing listing access', async () => {
    loader.and.rejectWith(new Error('WebGL unavailable'));
    fixture.componentRef.setInput('listings', [home]); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Retry map');
    expect(fixture.nativeElement.querySelector('ol a').getAttribute('href')).toBe('/listings/1');
  });
});

// Verify that theming changes paint only, preserving the external data source.
import { navyMapStyle } from './map-style';
import type { StyleSpecification } from 'maplibre-gl';
describe('Public navy map palette', () => {
  it('preserves provider data/attribution and makes labels readable', () => {
    const style: StyleSpecification = { version: 8, sources: {}, layers: [
      { id: 'background', type: 'background' },
      { id: 'place', type: 'symbol', source: 'homes', layout: { 'text-field': '{name}' } },
    ] };
    const dark = navyMapStyle(style);
    expect(dark.sources).toBe(style.sources);
    expect((dark.layers[0].paint as any)['background-color']).toBe('#0d1020');
    expect((dark.layers[1].paint as any)['text-color']).toBe('#bdc1d9');
    expect(style.layers[0].paint).toBeUndefined();
  });
});

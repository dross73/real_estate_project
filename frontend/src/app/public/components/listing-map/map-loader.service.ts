import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

@Injectable({ providedIn: 'root' })
export class MapLoaderService {
  private readonly document = inject(DOCUMENT);
  load(): Promise<typeof import('maplibre-gl')> {
    if (!this.document.querySelector('link[data-listing-map]')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/vendor/maplibre-gl.css';
      link.dataset['listingMap'] = 'true';
      this.document.head.appendChild(link);
    }
    return import('maplibre-gl').then(library => {
      // Explicit static module worker avoids bundler-relative worker URLs.
      library.setWorkerUrl('/vendor/maplibre-gl-worker.mjs');
      return library;
    });
  }
}

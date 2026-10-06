import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import type { PublicTheme } from './public-theme.service';

export const HERO_IMAGES: Record<PublicTheme, string> = {
  light: '/images/juniper-lane-hero-light.webp',
  dark: '/images/juniper-lane-hero-dark.webp',
};

@Injectable({ providedIn: 'root' })
export class HeroImageService {
  private readonly document = inject(DOCUMENT);
  // Keep decoded image references across Home → Listings → Home navigation.
  private readonly images = new Map<PublicTheme, { image: HTMLImageElement; ready: Promise<void> }>();

  warm(theme: PublicTheme): Promise<void> {
    return this.load(theme, 'high')
      .then(() => this.load(theme === 'light' ? 'dark' : 'light', 'low'))
      .catch(() => { /* The CSS background still works; retry on the next visit/theme change. */ });
  }

  private load(theme: PublicTheme, priority: 'high' | 'low'): Promise<void> {
    const existing = this.images.get(theme);
    if (existing) {
      if (priority === 'high') existing.image.fetchPriority = 'high';
      return existing.ready;
    }

    const image = this.document.createElement('img');
    image.decoding = 'async';
    image.fetchPriority = priority;
    const ready = new Promise<void>((resolve, reject) => {
      image.onload = () => {
        // Decode before warming the alternate, so it cannot delay the active hero.
        const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
        void decoded.then(resolve, reject);
      };
      image.onerror = () => reject(new Error('Hero image unavailable'));
      image.src = HERO_IMAGES[theme];
    }).then(() => {
      image.onload = image.onerror = null;
    }).catch(error => {
      image.onload = image.onerror = null;
      this.images.delete(theme);
      throw error;
    });
    this.images.set(theme, { image, ready });
    return ready;
  }
}

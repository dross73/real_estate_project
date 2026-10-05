import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

export type PublicTheme = 'light' | 'dark';

const STORAGE_KEY = 'juniper_lane_public_theme';

@Injectable({ providedIn: 'root' })
export class PublicThemeService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly destroyRef = inject(DestroyRef);
  private readonly systemPreference = this.window?.matchMedia?.('(prefers-color-scheme: dark)');
  private manualPreference = this.readPreference();
  private readonly currentTheme = signal<PublicTheme>(this.manualPreference ?? this.systemTheme());

  readonly theme = this.currentTheme.asReadonly();

  constructor() {
    const onSystemChange = () => {
      if (!this.manualPreference) {
        this.currentTheme.set(this.systemTheme());
      }
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        this.manualPreference = this.readPreference();
        this.currentTheme.set(this.manualPreference ?? this.systemTheme());
      }
    };

    this.systemPreference?.addEventListener('change', onSystemChange);
    this.window?.addEventListener('storage', onStorageChange);
    this.destroyRef.onDestroy(() => {
      this.systemPreference?.removeEventListener('change', onSystemChange);
      this.window?.removeEventListener('storage', onStorageChange);
    });
  }

  toggle(): void {
    this.manualPreference = this.theme() === 'dark' ? 'light' : 'dark';
    this.currentTheme.set(this.manualPreference);
    try {
      this.window?.localStorage.setItem(STORAGE_KEY, this.manualPreference);
    } catch {
      // The current visit still works when browser storage is unavailable.
    }
  }

  private systemTheme(): PublicTheme {
    return this.systemPreference?.matches ? 'dark' : 'light';
  }

  private readPreference(): PublicTheme | null {
    try {
      const stored = this.window?.localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null;
    }
  }
}

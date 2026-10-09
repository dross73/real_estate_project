import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { PublicThemeService } from './public-theme.service';

describe('PublicThemeService', () => {
  const key = 'juniper_lane_public_theme';
  let stored: Map<string, string>;
  let media: EventTarget & { matches: boolean };
  let browser: EventTarget;
  let getItem: jasmine.Spy;
  let setItem: jasmine.Spy;

  beforeEach(() => {
    stored = new Map();
    media = Object.assign(new EventTarget(), { matches: false });
    getItem = jasmine.createSpy('getItem').and.callFake((name: string) => stored.get(name) ?? null);
    setItem = jasmine.createSpy('setItem').and.callFake((name: string, value: string) => stored.set(name, value));
    browser = Object.assign(new EventTarget(), {
      matchMedia: () => media,
      localStorage: { getItem, setItem },
    });
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: browser } }],
    });
  });

  it('should follow the system on first visit without persisting a choice', () => {
    media.matches = true;
    const service = TestBed.inject(PublicThemeService);
    expect(service.theme()).toBe('dark');
    expect(setItem).not.toHaveBeenCalled();
    media.matches = false;
    media.dispatchEvent(new Event('change'));
    expect(service.theme()).toBe('light');
  });

  for (const preference of ['light', 'dark'] as const) {
    it(`should restore saved ${preference} over a different system preference`, () => {
      stored.set(key, preference);
      media.matches = preference !== 'dark';
      const service = TestBed.inject(PublicThemeService);
      expect(service.theme()).toBe(preference);
      media.dispatchEvent(new Event('change'));
      expect(service.theme()).toBe(preference);
    });
  }

  it('should ignore invalid stored preferences', () => {
    stored.set(key, 'invalid');
    media.matches = true;
    expect(TestBed.inject(PublicThemeService).theme()).toBe('dark');
  });

  it('should save manual toggles and ignore subsequent system changes', () => {
    const service = TestBed.inject(PublicThemeService);
    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(stored.get(key)).toBe('dark');
    media.dispatchEvent(new Event('change'));
    expect(service.theme()).toBe('dark');
    service.toggle();
    expect(stored.get(key)).toBe('light');
  });

  it('should synchronize a preference saved or cleared in another tab', () => {
    const service = TestBed.inject(PublicThemeService);
    stored.set(key, 'dark');
    browser.dispatchEvent(new StorageEvent('storage', { key }));
    expect(service.theme()).toBe('dark');
    stored.delete(key);
    browser.dispatchEvent(new StorageEvent('storage', { key }));
    expect(service.theme()).toBe('light');
    stored.set(key, 'dark');
    browser.dispatchEvent(new StorageEvent('storage', { key: 'access_token' }));
    expect(service.theme()).toBe('light');
  });

  it('should keep theme switching usable when storage is blocked', () => {
    getItem.and.throwError('blocked');
    setItem.and.throwError('blocked');
    const service = TestBed.inject(PublicThemeService);
    expect(service.theme()).toBe('light');
    expect(() => service.toggle()).not.toThrow();
    expect(service.theme()).toBe('dark');
    media.dispatchEvent(new Event('change'));
    expect(service.theme()).toBe('dark');
  });

  it('should release browser listeners when destroyed', () => {
    const removeMedia = spyOn(media, 'removeEventListener').and.callThrough();
    const removeBrowser = spyOn(browser, 'removeEventListener').and.callThrough();
    TestBed.inject(PublicThemeService);
    TestBed.resetTestingModule();
    expect(removeMedia).toHaveBeenCalledWith('change', jasmine.any(Function));
    expect(removeBrowser).toHaveBeenCalledWith('storage', jasmine.any(Function));
  });

  it('should work without browser APIs', () => {
    TestBed.overrideProvider(DOCUMENT, { useValue: { defaultView: null } });
    const service = TestBed.inject(PublicThemeService);
    expect(service.theme()).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
  });
});

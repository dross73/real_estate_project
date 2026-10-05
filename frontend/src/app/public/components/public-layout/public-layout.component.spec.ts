import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicThemeService } from '../../../services/public-theme.service';

import { AuthService } from '../../../services/auth.service';
import { SiteSettingsService } from '../../../services/site-settings.service';
import { PublicLayoutComponent } from './public-layout.component';

describe('PublicLayoutComponent', () => {
  let component: PublicLayoutComponent;
  let fixture: ComponentFixture<PublicLayoutComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let siteSettingsService: jasmine.SpyObj<SiteSettingsService>;

  beforeEach(async () => {
    localStorage.removeItem('juniper_lane_public_theme');
    const matchMedia = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake((query) =>
      query === '(prefers-color-scheme: dark)'
        ? Object.assign(new EventTarget(), { matches: false }) as MediaQueryList
        : matchMedia(query),
    );
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isAuthenticated',
      'getUserRole',
      'logout',
    ]);
    authService.isAuthenticated.and.returnValue(false);
    authService.getUserRole.and.returnValue(null);

    siteSettingsService = jasmine.createSpyObj<SiteSettingsService>(
      'SiteSettingsService',
      ['getPublicSettings'],
    );
    siteSettingsService.getPublicSettings.and.returnValue(of({
      site_name: 'Juniper & Lane',
      site_descriptor: 'Realty',
      tagline: 'A brighter tomorrow belongs here.',
      logo_url: null,
      phone: null,
      email: null,
      address_line1: null,
      city: null,
      state: null,
      postal_code: null,
      homepage_eyebrow: 'Homes rooted in a brighter tomorrow',
      homepage_title: 'Local People. Lasting Places.',
      homepage_intro: 'Community-first guidance.',
      homepage_story_title: 'Rooted in community.',
      homepage_story_copy: 'Local relationships matter.',
      primary_color: '#13382b',
      secondary_color: '#738c78',
      show_about: true,
      show_contact: true,
      show_testimonials: false,
      enable_testimonial_submissions: false,
      enable_contact_requests: true,
      enable_showing_requests: true,
      listing_photo_max_count: 50,
      hard_listing_photo_max_count: 50,
      updated_at: null,
    }));

    await TestBed.configureTestingModule({
      imports: [PublicLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: SiteSettingsService, useValue: siteSettingsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply configured brand colors to the public shell', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.style.getPropertyValue('--public-color-forest')).toBe('#13382b');
    expect(host.style.getPropertyValue('--public-color-sage')).toBe('#738c78');
  });

  afterEach(() => localStorage.removeItem('juniper_lane_public_theme'));

  it('should change only the public shell and preserve light brand colors', () => {
    const shell = fixture.nativeElement.querySelector('.public-site') as HTMLElement;
    const theme = TestBed.inject(PublicThemeService);
    const rootTheme = document.documentElement.getAttribute('data-theme');
    const rootScheme = document.documentElement.style.colorScheme;
    expect(shell.getAttribute('data-theme')).toBe('light');
    expect(getComputedStyle(shell).getPropertyValue('--public-color-forest').trim()).toBe('#13382b');
    theme.toggle();
    fixture.detectChanges();
    expect(shell.getAttribute('data-theme')).toBe('dark');
    expect(getComputedStyle(shell).getPropertyValue('--public-color-forest').trim()).toBe('#b4dbbc');
    expect(document.documentElement.getAttribute('data-theme')).toBe(rootTheme);
    expect(document.documentElement.style.colorScheme).toBe(rootScheme);
    theme.toggle();
    fixture.detectChanges();
    expect(getComputedStyle(shell).getPropertyValue('--public-color-forest').trim()).toBe('#13382b');
  });

  it('should expose an accessible theme toggle immediately before sign-in on desktop and mobile', () => {
    const desktop = fixture.nativeElement.querySelector('.desktop-actions app-theme-toggle');
    expect(desktop.nextElementSibling.textContent).toContain('Sign In');
    const button = desktop.querySelector('button');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');
    expect(button.title).toBe('Switch to dark mode');
    expect(button.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
    fixture.nativeElement.querySelector('.menu-button').click();
    fixture.detectChanges();
    const mobile = fixture.nativeElement.querySelector('.mobile-nav app-theme-toggle');
    expect(mobile.nextElementSibling.textContent).toContain('Sign In');
    expect(mobile.querySelector('button').getAttribute('aria-label')).toBe('Switch to light mode');
  });

  it('should keep the theme toggle immediately before sign-out for customer accounts', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getUserRole.and.returnValue('public_user');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.menu-button').click();
    fixture.detectChanges();
    for (const selector of ['.desktop-actions', '.mobile-nav']) {
      const toggle = fixture.nativeElement.querySelector(`${selector} app-theme-toggle`);
      expect(toggle.nextElementSibling.textContent).toContain('Sign Out');
    }
  });

  it('should expose the appropriate hero image token without altering account behavior', () => {
    const shell = fixture.nativeElement.querySelector('.public-site');
    expect(getComputedStyle(shell).getPropertyValue('--public-hero-image')).toContain('juniper-lane-hero-light.webp');
    TestBed.inject(PublicThemeService).toggle();
    fixture.detectChanges();
    expect(getComputedStyle(shell).getPropertyValue('--public-hero-image')).toContain('juniper-lane-hero-dark.webp');
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('should maintain readable text and action contrast in both theme palettes', () => {
    const shell = fixture.nativeElement.querySelector('.public-site') as HTMLElement;
    const luminance = (hex: string) => {
      const rgb = hex.replace('#', '').match(/../g)!.map((part) => {
        const value = parseInt(part, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    for (const theme of ['light', 'dark']) {
      if (component.theme.theme() !== theme) component.theme.toggle();
      fixture.detectChanges();
      const style = getComputedStyle(shell);
      const color = (name: string) => luminance(style.getPropertyValue(`--public-color-${name}`).trim());
      for (const [foreground, background] of [
        ['text', 'page'], ['muted', 'page'], ['text', 'surface'], ['muted', 'surface'],
        ['forest', 'soft'], ['on-action', 'action'], ['on-action', 'action-hover'],
        ['error', 'error-background'], ['success', 'success-background'], ['warning', 'warning-background'],
      ]) {
        const a = color(foreground), b = color(background);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))
          .withContext(`${theme}: ${foreground} on ${background}`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

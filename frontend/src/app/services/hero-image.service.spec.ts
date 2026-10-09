import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { HERO_IMAGES, HeroImageService } from './hero-image.service';

interface TestImage {
  src: string;
  decoding: string;
  fetchPriority: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  decode: jasmine.Spy;
}

describe('Homepage hero image warming', () => {
  let images: TestImage[];
  let service: HeroImageService;
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  beforeEach(() => {
    images = [];
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: {
      createElement: () => {
        const image: TestImage = { src: '', decoding: '', fetchPriority: '', onload: null, onerror: null,
          decode: jasmine.createSpy('decode').and.resolveTo() };
        images.push(image);
        return image;
      },
    } }] });
    service = TestBed.inject(HeroImageService);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`loads ${theme} first and waits for its decode before warming the alternate at low priority`, async () => {
      let finishDecode!: () => void;
      const ready = service.warm(theme);
      expect(images.length).toBe(1);
      expect(images[0].src).toBe(HERO_IMAGES[theme]);
      expect(images[0].fetchPriority).toBe('high');
      images[0].decode.and.returnValue(new Promise<void>(resolve => { finishDecode = resolve; }));
      images[0].onload!(); await flush();
      expect(images.length).toBe(1);
      finishDecode(); await flush();
      expect(images.length).toBe(2);
      expect(images[1].src).toBe(HERO_IMAGES[theme === 'light' ? 'dark' : 'light']);
      expect(images[1].fetchPriority).toBe('low');
      images[1].onload!(); await ready;
      expect(images.every(image => image.decoding === 'async')).toBeTrue();
    });
  }

  it('reuses decoded images on repeat home visits and theme toggles', async () => {
    const ready = service.warm('light');
    images[0].onload!(); await flush(); images[1].onload!(); await ready;
    await service.warm('dark'); await service.warm('light');
    expect(images.length).toBe(2);
    expect(images[0].decode).toHaveBeenCalledTimes(1);
    expect(images[1].decode).toHaveBeenCalledTimes(1);
  });

  it('promotes an alternate still loading when it becomes active without duplicating requests', async () => {
    const initial = service.warm('light'); images[0].onload!(); await flush();
    expect(images[1].fetchPriority).toBe('low');
    const toggle = service.warm('dark');
    expect(images[1].fetchPriority).toBe('high');
    expect(images.length).toBe(2);
    images[1].onload!(); await initial; await toggle;
  });

  it('handles failed image requests and retries on a subsequent visit', async () => {
    const failed = service.warm('light'); images[0].onerror!(); await failed;
    expect(images.length).toBe(1);
    const retry = service.warm('light'); expect(images.length).toBe(2);
    images[1].onload!(); await flush(); images[2].onload!(); await retry;
  });

  it('handles decode failures without unhandled rejections or warming the alternate', async () => {
    const ready = service.warm('dark'); images[0].decode.and.rejectWith(new Error('decode failed'));
    images[0].onload!(); await ready;
    expect(images.length).toBe(1);
    expect(images[0].onload).toBeNull();
  });
});

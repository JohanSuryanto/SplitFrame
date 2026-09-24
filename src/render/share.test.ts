import { canShareImages, isStoryShape, shareFile } from './share';

const png = () => new File([new Uint8Array([1, 2, 3])], 'splitframe-20260924-1200.png', { type: 'image/png' });

function stubNavigator(nav: Partial<Navigator>) {
  vi.stubGlobal('navigator', nav);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shareFile (T005)', () => {
  it('fails when the browser has no canShare', async () => {
    stubNavigator({ share: vi.fn() });
    expect(await shareFile(png())).toBe('failed');
  });

  it('fails without calling share when canShare says no', async () => {
    const share = vi.fn();
    stubNavigator({ canShare: () => false, share });
    expect(await shareFile(png())).toBe('failed');
    expect(share).not.toHaveBeenCalled();
  });

  it('shares only the file, with no title, text or url', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const file = png();
    stubNavigator({ canShare: () => true, share });
    expect(await shareFile(file)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file] });
  });

  it.each([
    [new DOMException('x', 'AbortError'), 'cancelled'],
    [new DOMException('x', 'NotAllowedError'), 'needs-gesture'],
    [new DOMException('x', 'DataError'), 'failed'],
    [new TypeError('x'), 'failed'],
  ])('maps a %s rejection to %s', async (error, outcome) => {
    stubNavigator({ canShare: () => true, share: vi.fn().mockRejectedValue(error) });
    expect(await shareFile(png())).toBe(outcome);
  });
});

describe('canShareImages (T005)', () => {
  it('is false when canShare is missing', () => {
    stubNavigator({});
    expect(canShareImages('png')).toBe(false);
  });

  it('is false when canShare throws', () => {
    stubNavigator({
      canShare: () => {
        throw new Error('nope');
      },
    });
    expect(canShareImages('png')).toBe(false);
  });

  it('probes with a file of the format MIME type', () => {
    const canShare = vi.fn().mockReturnValue(true);
    stubNavigator({ canShare });
    expect(canShareImages('png')).toBe(true);
    expect(canShareImages('jpg')).toBe(true);
    const types = canShare.mock.calls.map(([data]) => (data as ShareData).files?.[0]?.type);
    expect(types).toEqual(['image/png', 'image/jpeg']);
  });

  it('is false when canShare rejects the probe', () => {
    stubNavigator({ canShare: () => false });
    expect(canShareImages('jpg')).toBe(false);
  });
});

describe('isStoryShape (T005)', () => {
  it('accepts exact 9:16', () => {
    expect(isStoryShape({ width: 1080, height: 1920 })).toBe(true);
    expect(isStoryShape({ width: 720, height: 1280 })).toBe(true);
  });

  it('rejects other shapes', () => {
    expect(isStoryShape({ width: 1080, height: 1080 })).toBe(false);
    expect(isStoryShape({ width: 1920, height: 1080 })).toBe(false);
    expect(isStoryShape({ width: 1080, height: 1350 })).toBe(false);
  });
});

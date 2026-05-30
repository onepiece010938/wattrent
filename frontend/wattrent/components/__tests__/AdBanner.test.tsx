// Tests for AdBanner component.

import React from 'react';
import { render } from '@testing-library/react-native';

describe('AdBanner', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('renders nothing on web', () => {
    jest.doMock('react-native', () => ({
      __esModule: true,
      Platform: { OS: 'web', select: (m: Record<string, unknown>) => m.web ?? m.default },
      View: ({ children }: { children?: React.ReactNode }) => children ?? null,
    }));
    jest.doMock('react-native-safe-area-context', () => ({
      __esModule: true,
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AdBanner = require('../AdBanner').default;
    const tree = render(<AdBanner />);
    expect(tree.toJSON()).toBeNull();
  });

  it('can be imported and rendered without throwing on the default jest platform', () => {
    // jest.setup.js mocks react-native-google-mobile-ads with BannerAd=() => null
    // so even on a "supported" platform the actual ad element is null. We only
    // assert that requiring + rendering succeeds; the visual result depends on
    // whatever Platform.OS jest-expo defaults to in this run.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AdBanner = require('../AdBanner').default;
    expect(() => render(<AdBanner />)).not.toThrow();
  });
});

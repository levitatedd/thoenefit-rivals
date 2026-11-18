const {
  MAX_BUILD_NUMBER,
  bumpVersion,
  compareVersions,
  parseVersion,
  resolveBuildNumber,
  resolveVariant,
  suggestBump,
} = require('../version');
const pkg = require('../../package.json');
const appJson = require('../../app.json');

describe('version source of truth', () => {
  it('package.json holds a valid SemVer version', () => {
    expect(() => parseVersion(pkg.version)).not.toThrow();
  });

  it('app.json does not define its own version, buildNumber or versionCode', () => {
    expect(appJson.expo.version).toBeUndefined();
    expect(appJson.expo.ios?.buildNumber).toBeUndefined();
    expect(appJson.expo.android?.versionCode).toBeUndefined();
  });

  it('app.config.js takes the version from package.json and build numbers from the environment', () => {
    const makeConfig = require('../../app.config');
    const prev = { ...process.env };
    try {
      process.env.APP_BUILD_NUMBER = '57';
      process.env.APP_VARIANT = 'staging';
      const config = makeConfig({ config: appJson.expo });
      expect(config.version).toBe(pkg.version);
      expect(config.ios.buildNumber).toBe('57');
      expect(config.android.versionCode).toBe(57);
      expect(config.extra).toEqual(
        expect.objectContaining({ buildNumber: 57, variant: 'staging' }),
      );
      // Static settings from app.json are preserved.
      expect(config.name).toBe(appJson.expo.name);
      expect(config.android.adaptiveIcon).toEqual(appJson.expo.android.adaptiveIcon);
    } finally {
      process.env = prev;
    }
  });
});

describe('parseVersion / compareVersions', () => {
  it('accepts plain MAJOR.MINOR.PATCH', () => {
    expect(parseVersion('0.1.0')).toEqual({ major: 0, minor: 1, patch: 0 });
    expect(parseVersion('12.0.3')).toEqual({ major: 12, minor: 0, patch: 3 });
  });

  it.each(['1.0', '01.0.0', '1.0.0-beta.1', '1.0.0+build', 'v1.0.0', '', null])(
    'rejects %p (iOS marketing versions must be numeric)',
    (value) => {
      expect(() => parseVersion(value)).toThrow('Invalid app version');
    },
  );

  it('compares numerically, not lexically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('0.1.9', '1.0.0')).toBeLessThan(0);
  });
});

describe('bumpVersion / suggestBump', () => {
  it('bumps and resets lower parts', () => {
    expect(bumpVersion('0.1.4', 'patch')).toBe('0.1.5');
    expect(bumpVersion('0.1.4', 'minor')).toBe('0.2.0');
    expect(bumpVersion('0.9.4', 'major')).toBe('1.0.0');
    expect(bumpVersion('0.1.4', 'none')).toBe('0.1.4');
    expect(() => bumpVersion('0.1.4', 'huge')).toThrow();
  });

  it('suggests minor for New, patch for Improved/Fixed, none for chores only', () => {
    expect(suggestBump({ new: 1, improved: 2, fixed: 3, chore: 4 })).toBe('minor');
    expect(suggestBump({ new: 0, improved: 1 })).toBe('patch');
    expect(suggestBump({ fixed: 1 })).toBe('patch');
    expect(suggestBump({ chore: 5 })).toBe('none');
    expect(suggestBump({})).toBe('none');
  });
});

describe('resolveBuildNumber / resolveVariant', () => {
  it('defaults to build 1 and the development variant for local builds', () => {
    expect(resolveBuildNumber({})).toBe(1);
    expect(resolveVariant({})).toBe('development');
  });

  it('accepts valid CI values', () => {
    expect(resolveBuildNumber({ APP_BUILD_NUMBER: '123' })).toBe(123);
    expect(resolveBuildNumber({ APP_BUILD_NUMBER: String(MAX_BUILD_NUMBER) })).toBe(
      MAX_BUILD_NUMBER,
    );
    expect(resolveVariant({ APP_VARIANT: 'production' })).toBe('production');
  });

  it.each(['0', '-1', '1.5', 'abc', String(MAX_BUILD_NUMBER + 1)])(
    'rejects build number %p',
    (value) => {
      expect(() => resolveBuildNumber({ APP_BUILD_NUMBER: value })).toThrow('APP_BUILD_NUMBER');
    },
  );

  it('rejects unknown variants', () => {
    expect(() => resolveVariant({ APP_VARIANT: 'beta' })).toThrow('APP_VARIANT');
  });
});

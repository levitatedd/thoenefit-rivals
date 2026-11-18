/* Regression test for #34: every routed screen's ScrollView must keep its content below the
   (translucent) iOS header, or the top of the screen is hidden behind it. */
/* global describe, it, expect, __dirname */
const { readdirSync, readFileSync, statSync } = require('fs');
const { join } = require('path');

const APP_DIR = join(__dirname, '..');

function routeFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : routeFiles(path);
    return name.endsWith('.tsx') && !name.startsWith('_') ? [path] : [];
  });
}

describe('screen insets (#34)', () => {
  const files = routeFiles(APP_DIR);

  it('finds the routed screens', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it.each(files.map((f) => [f.slice(APP_DIR.length + 1), f]))(
    '%s keeps scroll content below the header',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      const scrollViews = source.match(/<ScrollView\b[\s\S]*?>/g) ?? [];
      for (const tag of scrollViews) {
        expect(tag).toContain('contentInsetAdjustmentBehavior="automatic"');
      }
    },
  );
});

/* global it, expect, __dirname */
// Writes docs/SCORING-VALIDATION.md. Only runs via `npm run simulate:report`, because rendering
// runs every scenario at full size (a few minutes). Plain JS so it can use Node's fs/path.
const fs = require('fs');
const path = require('path');

const { renderReport } = require('../report');

const REPORT = path.resolve(__dirname, '../../../../../../../docs/SCORING-VALIDATION.md');
const maybe = process.env.UPDATE_SIM_REPORT === '1' ? it : it.skip;

maybe(
  'writes docs/SCORING-VALIDATION.md',
  () => {
    fs.writeFileSync(REPORT, renderReport());
    expect(fs.readFileSync(REPORT, 'utf8')).toContain('# Scoring validation');
  },
  15 * 60 * 1000,
);

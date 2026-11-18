// Regenerates docs/SCORING-VALIDATION.md from the scoring simulations (#14).
// Runs Jest once, in-band (no worker processes), with UPDATE_SIM_REPORT=1. Cross-platform.
const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(
  process.execPath,
  [
    require.resolve('jest/bin/jest'),
    '--runInBand',
    '--testTimeout=900000',
    path.join('src', 'features', 'scoring', 'simulation', '__tests__', 'report.test.js'),
  ],
  {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, UPDATE_SIM_REPORT: '1' },
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);

const path = require('node:path');

const root = path.resolve(__dirname, '..');
const local = path.join(root, '.local');
const research = path.join(local, 'cache', 'research');
const bench = path.join(local, 'cache', 'bench');
const pdf = path.join(local, 'exports', 'pdf');
const suites = new Set(['default', 'compat', 'accessibility', 'multiwindow', 'frames', 'install', 'responsive', 'scale']);
function suitePath(kind, suite = 'default') {
  suite ??= 'default';
  if (!suites.has(suite)) throw new Error(`Unknown test suite: ${suite}`);
  return path.join(local, kind, suite);
}

module.exports = { root, local, research, bench, pdf,
  vault: suite => suitePath('vaults', suite),
  profile: suite => suitePath('profiles', suite),
};

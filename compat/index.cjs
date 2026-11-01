// CommonJS consumers expect a synchronously callable export.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require('minimatch-actual');
const f = Object.assign(mod.minimatch, mod);
Object.defineProperty(f, '__esModule', { value: true });
f.default = f;
module.exports = f;

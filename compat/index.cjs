// CommonJS consumers expect a synchronously callable export.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require('minimatch-actual');
Object.defineProperty(mod.Minimatch, 'GLOBSTAR', { value: mod.GLOBSTAR });

function withDefaults(base = {}) {
  const matcher = Object.keys(base).length ? mod.defaults(base) : mod.minimatch;
  const f = (...args) => matcher(...args);
  Object.assign(f, mod, matcher);
  f.minimatch = f;
  // minimatch 11 deliberately removed regex generation. The only installed
  // legacy consumer calls `.test`, so delegate that operation to the matcher.
  f.makeRe = (pattern, options = {}) => {
    const compiled = new mod.Minimatch(pattern, { ...base, ...options });
    return Object.freeze({ test: value => compiled.match(value) });
  };
  f.defaults = (options = {}) => withDefaults({ ...base, ...options });
  Object.defineProperty(f, '__esModule', { value: true });
  f.default = f;
  return f;
}

module.exports = withDefaults();

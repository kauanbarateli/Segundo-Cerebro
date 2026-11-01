/** The legacy rule expects RegExp semantics that minimatch 11 no longer provides. */
export function assertLegacyMinimatchRuleDisabled(config) {
  for (const block of config) {
    if (!block.rules || !Object.hasOwn(block.rules, 'import/no-internal-modules')) continue;
    const value = block.rules['import/no-internal-modules'];
    const severity = Array.isArray(value) ? value[0] : value;
    if (severity !== 0 && severity !== 'off') {
      throw new Error('Revise a semântica de minimatch antes de habilitar import/no-internal-modules.');
    }
  }
}

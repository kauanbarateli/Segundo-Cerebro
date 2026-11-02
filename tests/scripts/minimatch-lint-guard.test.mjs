import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLegacyMinimatchRuleDisabled } from '../../scripts/verification/minimatch-lint-guard.mjs';

test('exige revisão antes de ativar regra com semântica legada de regex', () => {
  for (const value of ['error', 'warn', 1, 2, ['error', { allow: ['**/x'] }], [], undefined]) {
    assert.throws(() => assertLegacyMinimatchRuleDisabled([{}, { rules: { 'import/no-internal-modules': value } }]), /Revise a semântica/);
  }
  for (const value of [0, 'off', [0], ['off']]) {
    assert.doesNotThrow(() => assertLegacyMinimatchRuleDisabled([{ rules: { 'import/no-internal-modules': value } }]));
  }
  assert.doesNotThrow(() => assertLegacyMinimatchRuleDisabled([{}, { rules: { 'other/rule': 'error' } }]));
});

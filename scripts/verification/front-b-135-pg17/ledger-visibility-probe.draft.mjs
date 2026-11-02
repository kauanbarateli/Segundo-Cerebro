// Synthetic SQL syntax/branch test only; does not reproduce Supabase transport.
import { createHash } from 'node:crypto';

const PIN = 'd29322fe522a256c8a669a1936a33735320ccd03e1a6a7bddc297a94dbedfdd9';
const NAME = 'sc218_ledger_probe_20261102_5e81f9ab';
const fail = () => { throw Error('LEDGER_VISIBILITY_PROBE_REFUSED'); };
const cases = Object.freeze({
  absent: ['P2181', 'SC218_PROBE_ROW_NOT_VISIBLE', 0],
  visible: ['P2182', 'SC218_PROBE_ROW_VISIBLE', 1],
  duplicate: ['P2183', 'SC218_PROBE_MULTIPLE_ROWS', 2],
});

export function ledgerVisibilityPlan(bytes, kind) {
  if (!Buffer.isBuffer(bytes) || createHash('sha256').update(bytes).digest('hex') !== PIN || !Object.hasOwn(cases, kind)) fail();
  const [state, message, count] = cases[kind];
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes) || text.includes('$sc218_probe_bytes$')) fail();
  const rows = Array.from({length: count}, () => `('${NAME}')`).join(',');
  const setup = `CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(name text); ${rows ? `INSERT INTO supabase_migrations.schema_migrations(name) VALUES ${rows};` : ''}`;
  // Exact probe bytes are executed as a single dynamic SQL string in a nested
  // subtransaction. An unexpected success, SQLSTATE, or message is fatal.
  const run = `DO $sc218_test$ DECLARE actual_state text; actual_message text; BEGIN BEGIN EXECUTE $sc218_probe_bytes$${text}$sc218_probe_bytes$; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE, actual_message = MESSAGE_TEXT; END; IF actual_state IS DISTINCT FROM '${state}' OR actual_message IS DISTINCT FROM '${message}' THEN RAISE EXCEPTION 'LEDGER_VISIBILITY_UNEXPECTED_RESULT'; END IF; END $sc218_test$;`;
  return Object.freeze({setup,run});
}

export async function observeLedgerVisibility(ports, bytes, kind) {
  if (!ports || typeof ports.exec !== 'function') fail();
  const plan = ledgerVisibilityPlan(bytes, kind);
  await ports.exec(plan.setup);
  await ports.exec(plan.run);
  return Object.freeze({scenario:`ledger-visibility-${kind}-pg17`,status:'CASE_OBSERVED_CLEANUP_PENDING',acceptance:false,hostedCertified:false});
}

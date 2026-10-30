// Seven finite cases. Ports are supplied only by the owned Foundation envelope.
// No CLI, process, database, credentials or network starts on import.
import {
  RETENTION_CASES, RetentionNativeError, assertRetentionAbsence, assertRetentionBaseline, assertRetentionPostflight, blankRetentionReport,
  inspectRetentionHealth, retentionBlockingStatement, retentionRecord, retentionRefuse, retentionSqlContext,
  retentionStatement, validateRetentionReport,
} from './foundation-retention-contract.mjs';

const need = value => { if (!value) retentionRefuse('CASE_REFUSED'); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function result(row, action) {
  retentionRecord(row, ['ack', 'value'], 'FRAME_REFUSED'); need(row.ack === action); return row.value;
}
function exactSweep(value, expected) {
  retentionRecord(value, ['code', 'visited', 'cleaned', 'skipped', 'failed']);
  need(value.code === 'OK' && value.failed === 0 && Object.keys(expected).every(key => value[key] === expected[key])); return value;
}
function terminalOkay(value, refused = false) {
  return value && value.unknown === false && value.stdoutEof === true && value.stderrEof === true && value.exitSignal === null && value.closeSignal === null
    && value.exitCode === (refused ? 3 : 0) && value.closeCode === (refused ? 3 : 0) && value.groupAbsent === true
    && value.code === (refused ? 'SQL_REFUSED' : 'PASSED') && value.terminalCounts
    && ['stdoutEnd', 'stderrEnd', 'exit', 'close'].every(key => value.terminalCounts[key] === 1);
}
export async function runFoundationRetentionCases(contextInput, ports) {
  const context = retentionSqlContext(contextInput);
  retentionRecord(ports, ['prepareActors', 'cleanupActors', 'openSession', 'observer', 'pause', 'signal']);
  for (const key of ['prepareActors', 'cleanupActors', 'openSession', 'observer', 'pause']) if (typeof ports[key] !== 'function') retentionRefuse('ENVIRONMENT_REFUSED');
  if (!(ports.signal instanceof AbortSignal) || ports.signal.aborted) retentionRefuse('ENVIRONMENT_REFUSED');
  const report = blankRetentionReport();
  for (const [index, id] of RETENTION_CASES.entries()) {
    const row = report.cases[index], sessions = []; let actors, a, b, aRefused = false, known = true;
    const caseController = new AbortController(), abortCase = () => caseController.abort();
    ports.signal.addEventListener('abort', abortCase, { once: true });
    let caseExpired = false;
    const timer = setTimeout(() => { caseExpired = true; caseController.abort(); for (const s of sessions) s.abort(); }, 60000);
    const check = () => need(!caseExpired && !ports.signal.aborted);
    const call = async (session, action, data) => { check(); const reply = await session.request(retentionStatement(context, action, data)); check(); return ['IDENTITY', 'BEGIN', 'BEGIN_WAITING_COMMIT', 'COMMIT', 'ROLLBACK'].includes(action) ? reply : result(reply, action); };
    const tx = async (session, operation) => { await call(session, 'BEGIN'); const value = await operation(); await call(session, 'COMMIT'); return value; };
    const sweep = async expected => exactSweep(await call(b, 'SWEEP'), expected);
    const readHealth = async () => inspectRetentionHealth(await call(b, 'HEALTH'));
    try {
      check(); assertRetentionAbsence(await ports.observer(retentionStatement(context, 'ABSENCE')));
      // Health cursor reset is a real empty sweep, never a fabricated UPDATE.
      exactSweep(await ports.observer(retentionStatement(context, 'SWEEP')), { visited: 0, cleaned: 0, skipped: 0 });
      actors = retentionRecord(await ports.prepareActors(id, caseController.signal), ['a', 'b']); check();
      for (const actor of Object.values(actors)) retentionRecord(actor, ['id', 'sessionId']);
      a = await ports.openSession('a', caseController.signal); sessions.push(a); b = await ports.openSession('b', caseController.signal); sessions.push(b);
      const ia = await call(a, 'IDENTITY'), ib = await call(b, 'IDENTITY');
      need(ia.pid !== ib.pid && ia.bound === true && ib.bound === true);
      const data = { a: actors.a.id, sa: actors.a.sessionId, b: actors.b.id, sb: actors.b.sessionId, caseId: id };
      await call(a, 'BIND_ACTORS', data); await call(b, 'BIND_ACTORS', data); row.checks.identity = true;
      const original = assertRetentionBaseline(await call(b, 'BASELINE'));
      need(original.receiptCount === 0 && original.profileEvents === 0 && original.retentionEvents === 0 && original.retentionEventRounds === 0);
      if (['R01', 'R02', 'R03'].includes(id)) {
        const binding = await tx(a, () => call(a, 'PREPARE_PROFILE'));
        const expectedKeys = id === 'R01' ? ['roundId'] : ['intentId', 'roundId', 'roundGeneration', 'intentVersion'];
        retentionRecord(binding, expectedKeys); need(typeof binding.roundId === 'string');
        await call(b, 'BIND_ROUND', { roundId: binding.roundId });
      } else if (['R04', 'R05', 'R06'].includes(id)) await tx(b, () => call(b, 'PREPARE_VERSIONS'));

      if (id === 'R01') {
        const before = await call(a, 'READ_DEADLINE');
        retentionRecord(before, ['due', 'exact720h', 'deadlineHash']); need(before.exact720h === true && before.due === false);
        await call(a, 'SNAPSHOT'); await tx(a, () => call(a, 'PAUSE')); await tx(a, () => call(a, 'REPLAY_SAVE'));
        need(same(before, await call(a, 'READ_DEADLINE')));
        need(same(original, assertRetentionBaseline(await call(b, 'BASELINE'))));
      } else if (id === 'R02') {
        await tx(a, () => call(a, 'SET_NEAR_DEADLINE'));
        await call(b, 'BEGIN'); await call(b, 'LOCK_USER_SHARE_AND_ADVISORY'); await call(a, 'BEGIN_WAITING_COMMIT');
        // Attach a rejection handler immediately; never send a new intent.
        const pending = a.request(retentionStatement(context, 'PROFILE_COMMIT')).then(value => ({ value }), error => ({ error }));
        let blocked = false;
        for (let n = 0; n < 12; n++) {
          check(); const proof = result(await b.request(retentionBlockingStatement(context, ia.pid, ib.pid)), 'PROVE_A_BLOCKED');
          retentionRecord(proof, ['blocked', 'advisory']);
          if (proof.blocked === true && proof.advisory === true) { blocked = true; break; }
          await ports.pause(100);
        }
        need(blocked); let due = false;
        for (let n = 0; n < 12; n++) {
          const observed = await call(b, 'READ_DEADLINE'); need(observed.exact720h === true);
          if (observed.due === true) { due = true; break; }
          await ports.pause(1000);
        }
        need(due); exactSweep(await call(b, 'SWEEP'), { visited: 1, cleaned: 1, skipped: 0 }); await call(b, 'COMMIT');
        const settled = await pending;
        need(settled.error instanceof RetentionNativeError && settled.error.code === 'SQL_REFUSED' && settled.error.sqlRefusal?.sqlState === '40001');
        aRefused = true; row.sqlState = '40001';
        // ON_ERROR_STOP exits3: rollback is implicit at native connection end.
        // An ACK for a command that was never sent must not be manufactured.
        need(terminalOkay(await a.terminal(), true));
        need((await call(b, 'BACKENDS')).other === 0);
        need(same(original, assertRetentionBaseline(await call(b, 'BASELINE'))));
        assertRetentionPostflight(await call(b, 'POSTFLIGHT'), 1); need((await readHealth()).clean);
      } else if (id === 'R03') {
        await tx(a, () => call(a, 'SET_NEAR_DEADLINE'));
        await tx(a, () => call(a, 'PROFILE_COMMIT'));
        const committedBeforeDeadline = await call(a, 'READ_DEADLINE'); need(committedBeforeDeadline.due === false && committedBeforeDeadline.exact720h === true);
        const confirmed = assertRetentionBaseline(await call(b, 'BASELINE'));
        need(confirmed.receiptCount === 1 && confirmed.profileEvents === 1 && confirmed.profileHash !== original.profileHash && confirmed.foreignHash === original.foreignHash);
        await tx(b, () => call(b, 'EXPIRE_BOUND')); await sweep({ visited: 1, cleaned: 1, skipped: 0 });
        need(same(confirmed, assertRetentionBaseline(await call(b, 'BASELINE'))));
        assertRetentionPostflight(await call(b, 'POSTFLIGHT'), 1); need((await readHealth()).clean);
      } else if (id === 'R04') {
        const before = await call(b, 'HEALTH');
        await call(a, 'BEGIN'); await call(a, 'LOCK_GLOBAL_SWEEP');
        const busy = await call(b, 'SWEEP'); retentionRecord(busy, ['code']); need(busy.code === 'BUSY');
        const after = await call(b, 'HEALTH'); need(same(before.health, after.health));
        await call(a, 'ROLLBACK'); await sweep({ visited: 100, cleaned: 100, skipped: 0 }); await sweep({ visited: 2, cleaned: 2, skipped: 0 }); await sweep({ visited: 0, cleaned: 0, skipped: 0 });
        assertRetentionPostflight(await call(b, 'POSTFLIGHT'), 102); need((await readHealth()).clean);
      } else if (id === 'R05') {
        const blockedActor = await tx(b, () => call(b, 'BLOCK_BOUND_ACTOR'));
        retentionRecord(blockedActor, ['blocked']); need(blockedActor.blocked === true);
        await call(a, 'BEGIN'); await call(a, 'LOCK_AUTH_PARENT_UPDATE');
        await sweep({ visited: 100, cleaned: 0, skipped: 100 });
        const pending = await readHealth(); need(!pending.clean && pending.dueCount === 102);
        await sweep({ visited: 2, cleaned: 2, skipped: 0 });
        const laterOwner = await call(b, 'POSTFLIGHT'); need(laterOwner.expired === 2 && laterOwner.payload === 300 && laterOwner.drafts === 100);
        await call(a, 'ROLLBACK'); await sweep({ visited: 0, cleaned: 0, skipped: 0 });
        need((await call(b, 'POSTFLIGHT')).cursorCleared === true);
        await sweep({ visited: 100, cleaned: 100, skipped: 0 });
        assertRetentionPostflight(await call(b, 'POSTFLIGHT'), 102); need((await readHealth()).clean);
      } else if (id === 'R06') {
        await tx(b, () => call(b, 'BACKDATE')); const late = await readHealth();
        need(late.dueCount === 102 && late.oldestLagSeconds > 120 && late.expiredPayloadCount === 102); row.lagViolationObserved = true;
        await sweep({ visited: 100, cleaned: 100, skipped: 0 }); await sweep({ visited: 2, cleaned: 2, skipped: 0 }); await sweep({ visited: 0, cleaned: 0, skipped: 0 });
        assertRetentionPostflight(await call(b, 'POSTFLIGHT'), 102); need((await readHealth()).clean && row.lagViolationObserved);
      } else if (id === 'R07') {
        const acl = await call(b, 'ACL'); retentionRecord(acl, ['invoker', 'denied']); need(acl.invoker === true && acl.denied === true);
        need(same(original, assertRetentionBaseline(await call(b, 'BASELINE'))));
      }
      if (['R04', 'R05', 'R06'].includes(id)) need(same({ ...original, retentionEvents: 2, retentionEventRounds: 2 }, assertRetentionBaseline(await call(b, 'BASELINE'))));
      else if (!['R02', 'R03'].includes(id)) need(same(original, assertRetentionBaseline(await call(b, 'BASELINE'))));
      row.checks.material = true;
      for (const session of sessions) need(terminalOkay(await session.finish(), session === a && aRefused));
      need((await ports.observer(retentionStatement(context, 'BACKENDS'))).other === 0);
      row.checks.transactions = true;
    } catch {
      row.status = 'failed'; row.code = 'CASE_REFUSED'; report.code = 'CASE_REFUSED';
      for (const session of sessions) {
        try { if (session.metadata().transaction === 'open' && !session.metadata().pending && !session.metadata().failed) await session.request(retentionStatement(context, 'ROLLBACK')); } catch { known = false; }
        try { const end = await session.finish(); if (!terminalOkay(end, session === a && aRefused)) known = false; } catch { known = false; }
      }
    } finally {
      if (caseExpired || ports.signal.aborted || sessions.some(session => session.metadata().processPending || session.metadata().pending || session.metadata().unknown)) known = false;
      if (known && actors) {
        try {
          need((await ports.observer(retentionStatement(context, 'BACKENDS'))).other === 0);
          need(await ports.cleanupActors(actors));
          assertRetentionAbsence(await ports.observer(retentionStatement(context, 'ABSENCE')));
          exactSweep(await ports.observer(retentionStatement(context, 'SWEEP')), { visited: 0, cleaned: 0, skipped: 0 }); row.checks.cleanup = true;
        } catch { known = false; }
      }
      if (caseExpired || caseController.signal.aborted) known = false;
      clearTimeout(timer); ports.signal.removeEventListener('abort', abortCase);
      if (!known) { report.writeOutcomeUncertain = true; report.code = 'CLEANUP_UNCONFIRMED'; row.code = 'CLEANUP_UNCONFIRMED'; row.status = 'failed'; }
      report.pendingProcesses = sessions.filter(session => session.metadata().processPending).length;
    }
    if (row.status === 'failed' || !row.checks.cleanup) break;
    row.status = 'passed'; row.code = 'PASSED';
  }
  report.cleanupConfirmed = !report.writeOutcomeUncertain && report.pendingProcesses === 0 && report.cases.every(row => row.checks.cleanup);
  if (report.cleanupConfirmed && report.cases.every(row => row.status === 'passed')) { report.status = 'passed'; report.code = 'PASSED'; }
  return validateRetentionReport(report);
}

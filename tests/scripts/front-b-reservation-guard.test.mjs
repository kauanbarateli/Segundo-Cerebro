import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {qualifyDraftSql,requireDiagnosticOptIn,DRAFT_SHA256} from '../../scripts/verification/front-b-reservation-draft/guard.mjs';

test('diagnóstico exige opt-in e Node 24',()=>{
 assert.doesNotThrow(()=>requireDiagnosticOptIn('1','24.22.1'));
 for(const pair of [[undefined,'24.22.1'],['true','24.22.1'],['1','25.0.0'],['1',null]])assert.throws(()=>requireDiagnosticOptIn(...pair),{message:'RESERVATION_DIAGNOSTIC_REFUSED'});
});
test('somente os bytes fixados e sua barreira na transação são aceitos',async()=>{
 const source=await readFile(new URL('../../scripts/verification/front-b-signup-reservation-draft/candidate-reservation.sql.txt',import.meta.url));
 assert.equal(DRAFT_SHA256.length,64);const sql=qualifyDraftSql(source);assert.match(sql,/^-- UNREVIEWED SCRATCH CANDIDATE\./);assert.doesNotMatch(sql,/DO \$scratch_guard\$/);assert.match(sql,/BEGIN;/);assert.match(sql,/COMMIT;\s*$/);
 const corrupt=Buffer.from(source);corrupt[0]^=1;for(const value of [corrupt,Buffer.alloc(0),source.toString('utf8')])assert.throws(()=>qualifyDraftSql(value),{message:'RESERVATION_SQL_REFUSED'});
});

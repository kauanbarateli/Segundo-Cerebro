import test from 'node:test';
import {runReservationDiagnostic} from './front-b-reservation-diagnostic.opt-in.mjs';

// The default script suite records a skip, never a database PASS. Only the
// dedicated, explicitly opted-in invocation may open the in-memory fixture.
const flag=process.env.FRONT_B_RUN_RESERVATION_PGLITE;
test('reservation draft: diagnóstico PGlite opcional', {skip:flag===undefined?'explicit opt-in required':false,timeout:120000},async()=>{
 await runReservationDiagnostic();
});

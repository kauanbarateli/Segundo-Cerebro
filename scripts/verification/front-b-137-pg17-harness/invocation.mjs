/** Pure invocation recipe. Caller MUST independently qualify the container,
 * bootstrap the bound marker, enforce timeouts/cleanup and verify stdout. */
import { buildScenario } from './scenario.mjs';
export function buildInvocation(input){
 if(!input||Object.keys(input).sort().join(',')!=='candidateBytes,containerId,fixtureBytes,nonce,systemIdentifier'||typeof input.containerId!=='string'||!/^[a-f0-9]{64}$/.test(input.containerId))throw Error('SYNTHETIC_INVOCATION_REFUSED');
 const {containerId,...rest}=input;
 return Object.freeze({
  program:'docker',
  args:Object.freeze(['exec','--interactive','--user','postgres',containerId,'psql','--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1','--host','/var/run/postgresql','--username','postgres','--dbname','sc_metrics_fixture','--file=-']),
  stdin:buildScenario(rest),
  expectedStdout:'SC_METRICS_SYNTHETIC_OK\n',
 });
}

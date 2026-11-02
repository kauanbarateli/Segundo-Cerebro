/** Source-bound proposal only; never applies SQL or removes the original guard. */
import {createHash} from 'node:crypto';
const pins={barrier:'ffb71bd2d5f7696fb16dcf643c8720056c6e1850230d190009494bbf924ff3c3',wrappers:'ca2ea88972af7450dc9bc31d0fe427dc6540b1a7b494050c7118279c0d69d8bd'};
const guard="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
const fragmentGuard="DO $fragment_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED FEEDBACK WRAPPERS: DO NOT APPLY'; END $fragment_guard$;";
const fail=()=>{throw Error('FEEDBACK_COMPOSITION_REFUSED');};
export function compose(barrier,wrappers){
 for(const [k,b] of Object.entries({barrier,wrappers}))if(!Buffer.isBuffer(b)||createHash('sha256').update(b).digest('hex')!==pins[k])fail();
 const input=new TextDecoder('utf-8',{fatal:true}).decode(barrier),fragment=new TextDecoder('utf-8',{fatal:true}).decode(wrappers),marker='COMMIT;\n';
 const sequence=`BEGIN;\n${fragmentGuard}\n`,index=fragment.indexOf(sequence);
 if(input.split(guard).length!==2||!input.includes(`BEGIN;\n${guard}\n`)||input.split(marker).length!==2||!input.endsWith(marker)||fragment.includes(guard)||index<0||fragment.split(sequence).length!==2||fragment.split(fragmentGuard).length!==2||fragment.split(marker).length!==2||!fragment.endsWith(marker))fail();
 const body=fragment.slice(0,index)+fragment.slice(index+sequence.length,-marker.length);
 return Buffer.from(input.replace(marker,()=>body+'\n'+marker));
}

/** Pure source binding; caller must validate all Git blobs before importing generator. */
import { createHash } from 'node:crypto';
const pins={
 generatorBytes:[4499,'e6ec89b8b1845d452c347524548481a5c5280428262230823818b199af2747e9'],
 pathsBytes:[555,'9161632edb2c971a7aaa7fc03451e402d279372f85580529181aa09bde050c8c'],
 dictionaryBytes:[391,'b27588bd3279e952f29b3da900351e662a06bca55a565c2c9118c70c9946e6ec'],
 baseBytes:[3675,'55b72a3a566af68e4795b367707cda5745c70321e0186b1536fe6f63bdc3dd5f'],
};
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('SYNTHETIC_BINDING_REFUSED');};
export function verifyGeneratorSources(input){
 if(!input||Object.keys(input).sort().join(',')!==Object.keys(pins).sort().join(','))fail();
 for(const [key,[length,digest]] of Object.entries(pins)){const b=input[key];if(!Buffer.isBuffer(b)||b.length!==length||hash(b)!==digest)fail();}
}
export function verifyBinding(input,compileDictionary){
 if(!input||Object.keys(input).sort().join(',')!==['baseBytes','candidateBytes','dictionaryBytes','generatorBytes','pathsBytes','proposalBytes'].sort().join(',')||typeof compileDictionary!=='function')fail();
 const {baseBytes,candidateBytes,dictionaryBytes,generatorBytes,pathsBytes,proposalBytes}=input;
 verifyGeneratorSources({baseBytes,dictionaryBytes,generatorBytes,pathsBytes});
 if(!Buffer.isBuffer(candidateBytes)||!Buffer.isBuffer(proposalBytes)||!candidateBytes.equals(proposalBytes))fail();
 const result=compileDictionary(dictionaryBytes);
 if(result?.version!==`sha256:${pins.dictionaryBytes[1]}`||typeof result.sql!=='string')fail();
 let sql=baseBytes.toString('utf8');const marker='begin;\ncreate function public.signup_metrics';
 if(sql.split(marker).length!==2)fail();
 sql=sql.replace(marker,()=>"begin;\ndo $$ begin raise exception 'DRAFT_ONLY: nao autorizado para execucao'; end $$;\ncreate function public.signup_metrics");
 const start=sql.indexOf(' grouped as ('),end=sql.indexOf(', merged as (',start);
 if(start<0||end<start||sql.indexOf(' grouped as (',start+1)!==-1)fail();
 sql=sql.slice(0,start)+' '+result.sql+sql.slice(end);
 const key="select jsonb_build_object('totalPublic',t.n";if(sql.split(key).length!==2)fail();
 sql=sql.replace(key,`select jsonb_build_object('dictionaryVersion','${result.version}','totalPublic',t.n`);
 if(!candidateBytes.equals(Buffer.from(sql)))fail();
}

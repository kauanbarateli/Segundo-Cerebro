import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveConsent, withdrawOrigin, resumeConsent} from './consent-model.mjs';

const data={terms:'terms-v1',privacy:'privacy-v1',acceptedLegal:true,originPending:true,acceptedOrigin:true,originVersion:'origin-v1'};
const legal={terms:'terms-v1',privacy:'privacy-v1',originVersion:'origin-v1'};

test('snapshot is immutable and contains no UTM, password, or input object',()=>{
 const input={...data,utm_source:'synthetic-source',password:'synthetic-secret'};
 const state=reserveConsent(input);input.terms='terms-v2';input.acceptedOrigin=false;
 assert.deepEqual(Object.keys(state.snapshot).sort(),['originAccepted','originVersion','privacy','terms']);
 assert.equal(Object.isFrozen(state.snapshot),true);
 assert.deepEqual(resumeConsent(state,legal),{status:'ready',acceptOrigin:true,originVersion:'origin-v1'});
});
test('refusal or absence of explicit acceptance requires discard and cannot become acceptance on resume',()=>{
 const state=reserveConsent({...data,acceptedOrigin:false});
 assert.equal(state.discardPendingOrigin,true);
 assert.deepEqual(resumeConsent(state,legal),{status:'ready',acceptOrigin:false,originVersion:null});
});
test('withdrawal after prior acceptance wins for resumed finalization and is monotonic',()=>{
 const state=reserveConsent(data),withdrawn=withdrawOrigin(state),again=withdrawOrigin(withdrawn);
 assert.equal(again.snapshot,state.snapshot);assert.equal(again.originWithdrawn,true);assert.equal(again.discardPendingOrigin,true);
 assert.deepEqual(resumeConsent(again,legal),{status:'ready',acceptOrigin:false,originVersion:null});
});
test('changed legal version suspends resume instead of substituting new consent',()=>{
 assert.deepEqual(resumeConsent(reserveConsent(data),{...legal,terms:'terms-v2'}),{status:'legal-changed'});
});
test('changed origin consent version blocks acceptance, while withdrawal still prevails',()=>{
 const state=reserveConsent(data),changed={...legal,originVersion:'origin-v2'};
 assert.deepEqual(resumeConsent(state,changed),{status:'origin-version-changed'});
 assert.deepEqual(resumeConsent(withdrawOrigin(state),changed),{status:'ready',acceptOrigin:false,originVersion:null});
});
test('missing legal or origin consent version fails closed',()=>{
 assert.throws(()=>reserveConsent({...data,acceptedLegal:false}));
 assert.throws(()=>reserveConsent({...data,originVersion:null}));
 assert.throws(()=>reserveConsent({...data,privacy:''}));
});

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { projectOwnSessions, validOwnSessionsView, OwnSessionsReadError } from '../../src/core/configuracoes/own-sessions';
const sid = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const other = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const row = (id=sid,current=true) => ({id,is_current:current,created_at:null,refreshed_at:'2026-10-11T08:15:10.123456+00:00',not_after:null});
const payload = () => ({ sessions:[row(),row(other,false)],has_more:false });
const denied = (value: unknown,code='UNAVAILABLE',expected=sid) => assert.throws(()=>projectOwnSessions(value,expected),error=>error instanceof OwnSessionsReadError && error.code===code);
test('server projection preserves nullable dates without identifiers or expiry in the browser',()=>{
 const source=payload(),before=JSON.stringify(source),view=projectOwnSessions(source,sid);
 assert.deepEqual(view,{sessions:[{isCurrent:true,createdAt:null,refreshedAt:'2026-10-11T08:15:10.123456+00:00'},{isCurrent:false,createdAt:null,refreshedAt:'2026-10-11T08:15:10.123456+00:00'}],hasMore:false});
 assert.equal(JSON.stringify(source),before);assert.equal(JSON.stringify(view).includes(sid),false);assert.equal(JSON.stringify(view).includes('not_after'),false);assert.equal(validOwnSessionsView(view),true);
});
test('current marker must agree with the verified SID and occur exactly once in first position',()=>{
 denied(payload(),'SESSION_CHANGED',other);denied(payload(),'SESSION_CHANGED','malformed');
 for(const sessions of[[],[row(other,false)],[row(other,false),row()],[row(sid,false)],[row(),row(other,true)]])denied({sessions,has_more:false},'SESSION_CHANGED');
 assert.equal(projectOwnSessions(payload(),sid.toUpperCase()).sessions[0]?.isCurrent,true);
});
test('extra provider metadata, duplicate ids and malformed markers fail closed',()=>{
 for(const value of[{...payload(),user_id:other},{...payload(),tokens:'private-canary'}, {sessions:[{...row(),ip:'private-canary'}],has_more:false}, {sessions:[row(),row(sid.toUpperCase(),false)],has_more:false},{sessions:[{...row(),is_current:'true'}],has_more:false}])denied(value);
});
test('100-item bound and truncation are factual; no unbounded or impossible envelope is accepted',()=>{
 const sessions=[row(),...Array.from({length:99},(_,i)=>row('cccccccc-3333-4333-8333-'+String(i).padStart(12,'0'),false))];
 assert.equal(projectOwnSessions({sessions,has_more:true},sid).hasMore,true);
 assert.equal(projectOwnSessions({sessions,has_more:false},sid).hasMore,false);
 denied({sessions:sessions.slice(0,99),has_more:true});denied({sessions:[...sessions,row(other,false)],has_more:false});denied({...payload(),has_more:'false'});
});
test('dates keep unknown separate from a valid instant and reject impossible or unzoned values',()=>{
 for(const date of[null,'2024-02-29T23:59:59Z','2026-10-11T08:15:10.123456-03:00'])assert.equal(projectOwnSessions({sessions:[{...row(),created_at:date,refreshed_at:date,not_after:date}],has_more:false},sid).sessions[0]?.createdAt,date);
 for(const date of['2026-02-30T00:00:00Z','2026-10-11 08:15:10','infinity',{},1,'x'.repeat(100)])for(const key of['created_at','refreshed_at','not_after'])denied({sessions:[{...row(),[key]:date}],has_more:false});
});
test('browser contract accepts only the reduced envelope and requires its current session',()=>{
 const view=projectOwnSessions(payload(),sid);
 for(const value of[payload(),{...view,sessionId:sid},{sessions:[],hasMore:false},{sessions:[{...view.sessions[0],id:sid}],hasMore:false},{sessions:[{...view.sessions[0],isCurrent:false}],hasMore:false},{sessions:[view.sessions[0],view.sessions[0]],hasMore:false},{...view,hasMore:true}])assert.equal(validOwnSessionsView(value),false);
 assert.equal(validOwnSessionsView(view),true);
});

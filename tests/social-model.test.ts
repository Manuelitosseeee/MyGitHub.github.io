import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekKey,weekSeconds,roomFrom,roomState} from '../src/social/model';
import {initialPixel,begin,finish} from '../src/pixel/model';
import type {DBState} from '../src/data/types';
const now=new Date('2026-11-04T12:00:00').getTime(),start=new Date('2026-11-02T12:00:00').getTime();
const state=()=>({practices:[],sessions:[]} as Pick<DBState,'practices'|'sessions'> as DBState);
test('week starts Monday including Sunday and year boundary',()=>{assert.equal(weekKey(now),'2026-11-02');assert.equal(weekKey(new Date('2026-11-08T12:00:00').getTime()),'2026-11-02');assert.equal(weekKey(new Date('2027-01-01T12:00:00').getTime()),'2026-12-28');});
test('pixel receipts and diary credited sessions count once, plus practice without session',()=>{
 const p=finish(begin(initialPixel(),'song','private title',start,'receipt'),start+60000);const st=state();
 st.practices=[{id:'p',songId:'song',date:'2026-11-02',seconds:60,updatedAt:start},{id:'p2',songId:'other',date:'2026-11-03',seconds:120,updatedAt:start}];
 assert.equal(weekSeconds(st,p,now),180);
 st.sessions=[{id:'receipt',songId:'song',start,end:start+60000,activeSeconds:60,startBpm:null,finalBpm:null}];assert.equal(weekSeconds(st,p,now),180);
});
test('room sharing preserves all furnishings without song titles or economy',()=>{
 const p=begin({...initialPixel(),owned:['rug','desk'],rainOn:false},'secret-id','private title',now,'private-session');const r=roomFrom(p);assert.deepEqual(r.owned,p.owned);assert.ok(!JSON.stringify(r).includes('private'));assert.equal(roomState(r,true).session?.status,'running');assert.equal(roomState({...r,elapsed:1000},false).session?.status,'paused');
});

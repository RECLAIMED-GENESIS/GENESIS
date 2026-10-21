import test from 'node:test';
import assert from 'node:assert/strict';
import { nextLabStep } from '../src/game/labProcedure.js';
function lab() {
  const L = {
    station:{checkedIn:false,doorOpen:true},signedIn:false,gloves:false,carried:null,reports:{},
    cyber:{staged:'bag',flags:new Set()}, bio:{t:0},
    trace:{focus:10,turret:'10x',verdicts:{}},docs:{},photos:new Set(),
    _hasPhoto(id){return this.photos.has(id);},
    _traceClaimComplete(){const t=this.trace;return Object.keys(t.verdicts).length>=2 && (t.claim==='inconclusive' || (t.claim && t.claimPick && t.verdicts[t.claimPick]==='consistent'));},
  };
  return L;
}
const expect=(L,id)=>assert.equal(nextLabStep(L).id,id);
test('arrival and phone guidance follows actual actions, including shielding and safety',()=>{
  const L=lab();expect(L,'reception');L.station.checkedIn=true;expect(L,'intake');
  L.signedIn=true;expect(L,'gloves');L.gloves=true;expect(L,'phone');
  L.cyber.staged='carried';expect(L,'shield');L.cyber.staged='faraday';expect(L,'retrieve');
  L.carried={id:'phone'};expect(L,'cradle');L.carried=null;L.cyber.staged='cradle';expect(L,'dump');
  L.cyber.term={busy:true,files:{}};expect(L,'acquiring');
  L.cyber.term={busy:false,files:{'lock.hash':true}};expect(L,'crack');
  L.cyber.unitDone=true;expect(L,'pin');L.cyber.unlocked=true;expect(L,'airplane');
  assert.equal(nextLabStep(L).urgent,true);L.cyber.airplane=true;
  for(const flag of ['messages','maps','contacts']){expect(L,`flag-${flag}`);L.cyber.flags.add(flag);}
  expect(L,'photo-unit-display');L.photos.add('unit-display');expect(L,'digital-report');
  L.reports.digital={signed:false};expect(L,'cut');
});
test('DNA waits permit other work; photographs, reports and signatures remain distinct',()=>{
  const L=lab();L.station.checkedIn=L.signedIn=L.gloves=true;L.reports.digital={signed:false};
  expect(L,'cut');L.bio.cut=true;expect(L,'lysis');L.bio.lysis=true;expect(L,'cartridge');L.bio.loaded=true;
  expect(L,'run');L.bio.running=true;expect(L,'strand');L.trace.strand=true;expect(L,'cover');L.trace.cover=true;
  expect(L,'reference');L.trace.openRef='a';expect(L,'focus');L.trace.focus=80;expect(L,'magnification');
  L.trace.turret='40x';expect(L,'verdict');L.trace.verdicts.a='excluded';expect(L,'another-reference');
  L.trace.openRef='b';expect(L,'verdict');L.trace.verdicts.b='unclear';expect(L,'claim');
  L.trace.claim='inconclusive';expect(L,'wand');L.carried={id:'uvwand'};expect(L,'glass');
  L.trace.glassUV=true;expect(L,'photo-microscope');L.photos.add('microscope');expect(L,'trace-report');L.reports.micro={signed:false};
  expect(L,'casing');L.docs.casingRead=true;expect(L,'trail');L.docs.trailRead=true;expect(L,'photo-casing');
  L.photos.add('casing');expect(L,'photo-trail');L.photos.add('trail');expect(L,'docs-report');L.reports.docs={signed:false};
  expect(L,'dna-wait');L.bio.t=120;assert.equal(nextLabStep(L).remaining,60);
  L.bio.ready=true;expect(L,'match');L.bio.matched=true;expect(L,'photo-sequencer');L.photos.add('sequencer');expect(L,'dna-report');
  L.reports.dna={signed:false};expect(L,'sign');for(const r of Object.values(L.reports))r.signed=true;
  L.station.doorOpen=false;expect(L,'office-door');L.station.doorOpen=true;expect(L,'deliver');L.station.departureReady=true;expect(L,'complete');
});
test('out-of-order work is preserved and phone danger overrides later tasks',()=>{
 const L=lab();L.station.checkedIn=L.signedIn=L.gloves=true;
 L.reports={digital:{signed:true},micro:{signed:true},dna:{signed:true},docs:{signed:true}};
 expect(L,'deliver');L.cyber.unlocked=true;expect(L,'airplane');
 L.cyber.wiped=true;expect(L,'deliver'); // A filed loss report is still valid evidence documentation.
});

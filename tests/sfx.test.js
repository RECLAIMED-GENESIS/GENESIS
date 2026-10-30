import test from 'node:test';
import assert from 'node:assert/strict';
import { Howler } from 'howler';
import { play, setVolume } from '../src/audio/sfx.js';

test('interaction foley uses the shared master bus and releases finished audio nodes',()=>{
  const saved={ctx:Howler.ctx,master:Howler.masterGain};const nodes=[],ends=[],connections=[];
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>{const n={connect(target){connections.push(target);},disconnect(){this.freed=true;},frequency:param(),gain:param(),start(){ends.push(this);},stop(){}};nodes.push(n);return n;};
  const master={};Howler.masterGain=master;
  Howler.ctx={currentTime:0,state:'running',sampleRate:8000,createOscillator:node,createGain:node,createBiquadFilter:node,createBufferSource:node,createBuffer:(_,length)=>({getChannelData:()=>new Float32Array(length)})};
  try {
    setVolume(0);play('pickup');assert.equal(ends.length,0,'Effects volume zero silences synthesized foley');setVolume(.8);
    for(const name of ['shutter','pickup','bagSeal','setDown','glassPlace','gloves','lightSwitch','uvPower','scanMark','record','door','instrumentStart']) {
      const count=ends.length;play(name);assert.ok(ends.length>count,`${name} schedules sound`);
    }
    assert.ok(connections.includes(master));
    for(const end of ends)end.onended();
    assert.ok(nodes.every(n=>n.freed));
  } finally {Howler.ctx=saved.ctx;Howler.masterGain=saved.master;}
});

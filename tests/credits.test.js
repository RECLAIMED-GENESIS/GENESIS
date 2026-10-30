import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CREDIT_GROUPS, renderAssetCredits } from '../src/ui/credits.js';
const entries=CREDIT_GROUPS.flatMap(g=>g.entries);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}

test('every shipped model, image, sound and animation has an attribution entry',()=>{
  const credited=new Set(entries.flatMap(e=>e.files));
  for(const file of [...files('public/assets'),...files('src/characters')]){
    if(file.endsWith('.md'))continue;
    assert.ok(credited.has(file),`Missing credit: ${file}`);
  }
  for(const file of credited)assert.ok(existsSync(file),`Stale credit: ${file}`);
});

test('model author, source and licence agree with embedded attribution',()=>{
  for(const file of files('public/assets/models').filter(p=>p.endsWith('.glb'))){
    const bytes=readFileSync(file);
    const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const meta=data.asset.extras;if(!meta?.author)continue;
    const credit=entries.find(e=>e.files.includes(file));
    assert.equal(credit.source,meta.source);
    assert.equal(credit.creator,meta.author.split(' (https:')[0]);
    assert.equal(credit.license,'CC BY 4.0');
  }
});

test('credits preserve uncertainty and use safe, explicit source links',()=>{
  const html=renderAssetCredits();
  for(const e of entries){
    assert.ok(e.creator&&e.license&&e.evidence);
    for(const link of [e.source,e.licenseUrl].filter(Boolean))assert.equal(new URL(link).protocol,'https:');
    if(!e.source||/not yet|not identified|not recorded/.test(e.license))assert.equal(e.review,true,e.name);
  }
  assert.ok(html.includes('Creator not recorded'));
  assert.ok(html.includes('Source not recorded'));
  assert.ok(html.includes('Licence not recorded'));
  assert.ok(!html.includes('Source confirmation needed'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(!html.includes('Images found on Google'));
});

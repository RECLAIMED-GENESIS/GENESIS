import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
function sourceFiles(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(join(dir,e.name)):[join(dir,e.name)]);}

test('runtime asset URLs stay within the LAMP group folder',()=>{
  for(const file of sourceFiles('src').filter(p=>/\.(js|css)$/.test(p))){
    assert.doesNotMatch(readFileSync(file,'utf8'),/["'`]\/assets\//,file);
  }
  assert.doesNotMatch(readFileSync('index.html','utf8'),/(?:src|href)=["']\/(?!\/)/);
  const environment=readFileSync('src/levels/StationEnvironment.js','utf8');
  const wood=readFileSync('src/levels/StationWoodPanel.js','utf8');
  assert.ok(environment.includes('`./assets/textures/station-lite/'));
  assert.ok(environment.includes('`./assets/models/station/'));
  assert.ok(wood.includes("'./assets/models/station/wood_wall.glb'"));
  const base='https://example.test/student-games/404-found-us/';
  const assets=['./assets/models/station/wood_wall.glb',...['Tiles051','PaintedPlaster005','Bricks082A','WoodFloor041','Carpet006'].flatMap(id=>['Color','NormalGL','Roughness'].map(map=>`./assets/textures/station-lite/${id}_1K-JPG_${map}.jpg`))];
  for(const path of assets){assert.ok(new URL(path,base).href.startsWith(base));assert.ok(existsSync(join('public',path)));}
});

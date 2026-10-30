import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildStationLighting,setStationLabLighting,disposeStationLighting } from '../src/levels/StationLighting.js';
test('restored lighting preserves UV controls and restores the prior environment',()=>{
 const L={scene:new THREE.Scene(),level:new THREE.Group(),_hemi:new THREE.HemisphereLight(),_stripLights:[{pl:new THREE.PointLight(),flicker:true}],
 _std(color,roughness,metalness){return new THREE.MeshStandardMaterial({color,roughness,metalness});},
 _box(parent,w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}};
 const env=new THREE.Texture();L.scene.environment=env;L.scene.environmentIntensity=.75;
 buildStationLighting(L);
 assert.equal(L.scene.environment,env);
 assert.equal(L.level.children.filter(o=>o.isRectAreaLight).length,8);
 for(const {light} of L._taskLights) assert.equal(light.shadow.mapSize.width * light.shadow.mapSize.height,1024*1024);
 const labLights=new Set([...L._taskLights,...L._areaLights].map(s=>s.light));
 const other=L.level.children.filter(o=>o.isLight&&!labLights.has(o)&&o!==L._windowDaylight).map(o=>[o,o.intensity]);
 assert.equal(L.level.children.filter(o=>o.isLight&&o.castShadow).length,2);
 L._labWindow={amount:1};
 setStationLabLighting(L,true);assert.equal(L._windowDaylight.intensity,.18);for(const {light,intensity} of [...L._taskLights,...L._areaLights])assert.equal(light.intensity,intensity*.06);
 for(const [light,intensity] of other)assert.equal(light.intensity,intensity);
 setStationLabLighting(L,false);assert.equal(L._windowDaylight.intensity,3);for(const {light,intensity} of [...L._taskLights,...L._areaLights])assert.equal(light.intensity,intensity);
 disposeStationLighting(L);assert.equal(L.scene.environment,env);assert.equal(L.scene.environmentIntensity,.75);
});

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Reflection fill, ceiling area lights and two lab task-light shadow maps.
export function buildStationLighting(L) {
  RectAreaLightUniformsLib.init();
  L._previousEnvironment = L.scene.environment;
  L._previousEnvironmentIntensity = L.scene.environmentIntensity;
  if (L.renderer) {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(L.renderer);
    L._stationReflection = pmrem.fromScene(room, .06);
    L.scene.environment = L._stationReflection.texture;
    L.scene.environmentIntensity = .3;
    room.dispose(); pmrem.dispose();
  }
  L._hemi.color.setHex(0xcbddeb);
  L._hemi.groundColor.setHex(0x655d50);
  L._hemi.intensity = .42;
  L._taskLights = [];
  L._areaLights = [];
  const area = (color, intensity, width, height, x, y, z, target, lab = false) => {
    const light = new THREE.RectAreaLight(color, intensity, width, height);
    light.position.set(x,y,z); light.lookAt(...target); L.level.add(light);
    if (lab) L._areaLights.push({ light, intensity });
    return light;
  };
  for (const [x,z] of [[-6,2.5],[0,2.5],[6,2.5],[0,-3.5]]) {
    area(0xf1f3ed, 5, 3, .24, x, 3.22, z, [x,0,z], true);
  }
  for (const [x,z] of [[-6.8,-.3],[6.8,-.3]]) {
    const light = new THREE.SpotLight(0xf5f2e8, 48, 10, 1.02, .7, 2);
    light.position.set(x,3.18,z);
    light.target.position.set(x,.7,z);
    light.castShadow = true;
    light.shadow.autoUpdate = false; light.shadow.needsUpdate = true;
    (L._stationShadowLights ||= []).push(light);
    light.shadow.mapSize.set(1024,1024);
    light.shadow.camera.near = .2;
    light.shadow.camera.far = 10;
    light.shadow.bias = -.00015;
    light.shadow.normalBias = .025;
    L.level.add(light, light.target);
    L._taskLights.push({ light, intensity: 48 });
    const housing = L._box(L.level, 1.4,.08,.6,L._std(0x41494b,.45,.65),x,3.32,z);
    housing.userData.noShadow = true;
    const diffuser = L._box(L.level,1.25,.025,.48,new THREE.MeshStandardMaterial({color:0xeee9d8,emissive:0xffefd4,emissiveIntensity:1.5,roughness:.35}),x,3.265,z);
    diffuser.userData.noShadow = true;
  }
  for (const s of L._stripLights) { s.pl.intensity = 8; s.pl.distance = 10; s.pl.decay = 2; s.flicker = false; }
  // Daylight spilling in through the lab's north window (dims with the lab lights for UV work).
  L._windowDaylight = area(0xcbdff3, 3, 8, 1.6, -2, 2.2, -6.85, [-2, 1.0, 0]);
  L._windowDaylight.intensity = 3 * (.08 + .92 * (L._labWindow?.amount || 0));
  area(0xffe3ba, 4, 1.4,.2,15,3.2,12,[15,0,12]);
  for (const [x,z] of [[0,12],[-5,9]]) area(0xf5f1e7,4,1.5,.2,x,3.2,z,[x,0,z]);

}

export function setStationLabLighting(L, dark) {
  // UV examination dims only the lab fixtures; daylight and office lamps stay on.
  L._hemi.intensity = dark ? .22 : .42;
  for (const mat of L._labFixtureDiffusers || []) mat.emissiveIntensity = dark ? .03 : .6;
  if (L._windowDaylight) L._windowDaylight.intensity = 3 * (.08 + .92 * (L._labWindow?.amount || 0)) * (dark ? .06 : 1);
  for (const s of L._stripLights || []) s.pl.intensity = dark ? .6 : 8;
  for (const { light, intensity } of [...(L._taskLights || []), ...(L._areaLights || [])]) light.intensity = dark ? intensity * .06 : intensity;
}

export function disposeStationLighting(L) {
  L.scene.environment = L._previousEnvironment;
  L.scene.environmentIntensity = L._previousEnvironmentIntensity;
  L._stationReflection?.dispose();
  L.level.traverse(o => { if (o.isLight) o.shadow?.dispose(); });
}

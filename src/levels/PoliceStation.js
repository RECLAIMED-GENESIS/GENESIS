// Level 2's public entrance, captain's office and story progression.
// The lab stays at its original coordinates so every physical bench still works.
import * as THREE from 'three';
import { stationMaterial } from './StationEnvironment.js';

import { buildStationLayout, updateStationLife } from './StationLife.js';

const REPORTS = ['digital', 'micro', 'dna', 'docs'];
const CLOSED_MESSAGE = "Developer hasn't develop it yet";

export function installPoliceStation(Level) {
  Object.assign(Level.prototype, {
    _stationMaterial(kind, color = 0xffffff) {
      return stationMaterial(this, kind, color);
    },

    _stationSign(text, x, y, z, width = 2.5, rotation = 0, subtitle = '') {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#172f3a'; g.fillRect(0, 0, 1024, 256);
      g.strokeStyle = '#c4ae75'; g.lineWidth = 8; g.strokeRect(12, 12, 1000, 232);
      g.textAlign = 'center'; g.fillStyle = '#f4eddc';
      g.font = 'bold 54px sans-serif'; g.fillText(text, 512, subtitle ? 112 : 146, 950);
      if (subtitle) { g.font = '30px sans-serif'; g.fillStyle = '#c4d2d5'; g.fillText(subtitle, 512, 185, 950); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.FrontSide }));
      mesh.position.set(x, y, z); mesh.rotation.y = rotation; this.level.add(mesh);
      return mesh;
    },

    _stationWall(x, z, w, d, material, height = 3.4) {
      this._box(this.level, w, height, d, material, x, height / 2, z);
      const box = new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, height, z + d / 2));
      this.colliders.push(box);
      if (height > 2) (this._stationSightBlockers ||= []).push(box);
      return box;
    },

    _stationOfficer(x, z, name, rotation = 0, civilianColor = null) {
      const person = new THREE.Group();
      const cloth = this._std(civilianColor ?? 0x263c56), skin = this._std(0x77513b), boots = this._std(0x191b20);
      this._box(person, 0.48, 0.65, 0.28, cloth, 0, 1.15, 0);
      person.userData.limbs = [];
      for (const side of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(side * .14, .82, 0); person.add(leg);
        this._box(leg, .16, .36, .2, cloth, 0, -.18, 0);
        const knee = new THREE.Group(); knee.position.y = -.36; leg.add(knee);
        this._box(knee, .16, .34, .2, cloth, 0, -.17, 0);
        this._box(knee, .19, .12, .32, boots, 0, -.38, .06);
        const arm = new THREE.Group(); arm.position.set(side * .32, 1.42, 0); person.add(arm);
        this._box(arm, .14, .5, .18, cloth, 0, -.25, 0);
        this._box(arm, .12, .16, .14, skin, 0, -.56, 0);
        person.userData.limbs.push({arm, leg, knee, side});
      }
      const head = new THREE.Group(); head.position.y = 1.68; person.add(head); person.userData.head = head;
      const face = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8), skin); face.scale.y = 1.2; head.add(face);
      if(civilianColor === null) this._box(head, .34, .09, .32, cloth, 0, .17, .025);
      if(civilianColor === null) this._box(person, .07, .1, .012, this._std(0xc7a654, .4, .6), -.12, 1.34, .15);
      this._box(person, .5, .07, .3, boots, 0, .87, 0);
      person.position.set(x, 0, z); person.rotation.y = rotation; person.name = name;
      this.level.add(person); return person;
    },

    _buildStation() {
      const plaster = this._stationMaterial('plaster'), brick = this._stationMaterial('brick');
      const wood = this._stationMaterial('wood'), tile = this._stationMaterial('tile');
      const floor = (x, z, w, d, material, y = 0) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z);
        const uv = mesh.geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (material.map?.userData.stationKind === 'asphalt' ? 1 : w / 3), uv.getY(i) * (material.map?.userData.stationKind === 'asphalt' ? 1 : d / 3));
        this.level.add(mesh); return mesh;
      };
      floor(0, 23.5, 44, 13, this._stationMaterial('asphalt'));
      floor(0, 20.5, 42, 3, tile, 0.012);
      floor(0, 13, 20, 12, tile);
      floor(15, 12, 10, 10, this._stationMaterial('wood'));
      const ceiling = floor(0, 13, 20, 12, plaster, 3.4); ceiling.rotation.x = Math.PI / 2;
      const officeCeiling = floor(15, 12, 10, 10, plaster, 3.4); officeCeiling.rotation.x = Math.PI / 2;
      // Lobby exterior: a three-metre opening faces the outside spawn.
      this._stationWall(-5.8, 19, 8.4, 0.3, brick);
      this._stationWall(5.8, 19, 8.4, 0.3, brick);
      this._box(this.level, 20.3, 0.65, 0.35, brick, 0, 3.08, 19);
      this._stationWall(-10.15, 9, .3, 4, brick);
      this._stationWall(-10.15, 16, .3, 6, brick);
      this._box(this.level, .3, .6, 2, plaster, -10.15, 3.1, 12);
      this._stationWall(10.15, 18, 0.3, 2, brick);
      // Captain's office: doorway in the west wall, opening into the room.
      this._stationWall(10.15, 9, 0.3, 4, plaster);
      this._stationWall(10.15, 15, 0.3, 4, plaster);
      this._box(this.level, 0.3, 0.6, 2, plaster, 10.15, 3.1, 12);
      this._stationWall(15.15, 7, 10.3, 0.3, brick);
      this._stationWall(20.15, 12, 0.3, 10.3, brick);
      this._stationWall(15.15, 17, 10.3, 0.3, brick);
      this._officeDoor = new THREE.Group(); this._officeDoor.position.set(10.15, 0, 11);
      this._box(this._officeDoor, 0.12, 2.8, 2, wood, 0, 1.4, 1);
      this._box(this._officeDoor, 0.25, 0.06, 0.16, this._std(0xb7aa79, 0.3, 0.7), 0, 1.05, 1.75);
      this.level.add(this._officeDoor);
      this._doorCollider = new THREE.Box3(); this.colliders.push(this._doorCollider);
      this.station.doorOpen = false;
      this._setOfficeDoor(true);
      this._hit(10.15, 1.3, 12, 0.5, 2.6, 2, { kind: 'stationDoor' });
      // Ventilation grille above the corridor wall.
      const vent = this._std(0x4b5354, 0.6, 0.5);
      this._box(this.level, 0.08, 0.4, 1.1, vent, 9.95, 2.5, 10.1);
      for (let i = 0; i < 6; i++) this._box(this.level, 0.1, 0.025, 1, this._std(0x161e23), 9.9, 2.34 + i * 0.06, 10.1);

      this._stationSign('CENTRAL POLICE STATION', 0, 4.2, 19.2, 7, 0, 'PUBLIC ENTRANCE  /  DETECTIVE SERVICES');
      this._stationSign('FORENSIC LAB', -5, 2.9, 7.34, 3.5, 0, '01  /  SIGN IN BEFORE HANDLING EXHIBITS');
      this._stationSign('CAPT. R. MABASO', 9.96, 2.8, 12, 2.6, -Math.PI / 2, '02  /  CLOSE DOOR FOR BRIEFINGS');
      this._stationSign('RECEPTION', -5.5, 2.3, 14.13, 3.2);
      this._stationSign('EXIT', 0, 2.9, 18.8, 1.6, Math.PI);
      this._stationSign('RECEPTION / EXIT', -5, 3.05, 6.94, 1.5, Math.PI);
      // Reception desk, terminal, paperwork, waiting seats and noticeboard.
      this._stationWall(-5.5, 15.8, 4, 1.2, wood, 1.05);
      this._box(this.level, 4.15, 0.08, 1.35, this._std(0x3e4544), -5.5, 1.09, 15.8);
      this._box(this.level, 0.7, 0.45, 0.08, this._std(0x263944), -6.5, 1.37, 15.6);
      this._box(this.level, 0.55, 0.03, 0.4, this._std(0xe6dfcc), -4.8, 1.16, 15.9);
      this._receptionOfficer = this._stationOfficer(-5.5, 14.7, 'Constable D. Mokoena');
      this._hit(-5.5, 1.3, 15.8, 3.5, 2.2, 1.3, { kind: 'reception' });
      for (const x of [5, 6.2, 7.4]) {
        this._stationWall(x, 17.2, 0.8, 0.7, wood, 0.5);
        this._box(this.level, 0.8, 0.6, 0.12, wood, x, 0.8, 17.5);
      }
      this._stationSign('VISITOR INFORMATION', -9.97, 2, 15, 3, Math.PI / 2, 'RECEPTION • LAB • CAPTAIN / ALL OTHER WINGS CLOSED');
      this._stationSign('GENESIS / MUNICIPAL FILE 04', 16, 2, 7.2, 5, 0, 'DEPOT → UNFINISHED BEACHFRONT → CAVE SERVICE BRIDGE');
      // Two physically sealed routes. Approaching also explains the boundary.
      this._closedRoutes = [
        { x: -9.9, z: 9, label: 'CELLS & INTERVIEW ROOMS', rotation: Math.PI / 2 },
        { x: 5.5, z: 7.3, label: 'RECORDS & ADMINISTRATION', rotation: 0 },
      ];
      for (const route of this._closedRoutes) {
        const mesh = this._box(this.level, 1.8, 2.6, 0.1, wood, route.x, 1.3, route.z);
        mesh.rotation.y = route.rotation;
        this._stationSign(route.label, route.x + (route.rotation ? 0.08 : 0), 2, route.z + (route.rotation ? 0 : 0.08), 1.7, route.rotation, 'WING CLOSED');
        this._hit(route.x, 1.3, route.z, route.rotation ? 0.3 : 1.8, 2.6, route.rotation ? 1.8 : 0.3, { kind: 'stationClosed', label: route.label });
      }
      this._stationSign('DUTY ROSTER', 6, 2.1, 18.8, 3, Math.PI, 'RECEPTION / PATROL / FORENSIC SERVICES');
      this._hit(0, 1.2, 19, 3, 2.4, 0.4, { kind: 'stationExit', when: () => this.station.departureReady });
      // Bounded forecourt: low walls, bollards, parking stripes and a patrol car.
      this._stationWall(-22, 24, 0.4, 12, brick, 1.2);
      this._stationWall(22, 24, 0.4, 12, brick, 1.2);
      // Open frontage connects the forecourt to the city pavement.
      this._stationWall(21, 18, 2, 0.4, brick, 1.2);
      for (const x of [-3, 3]) this._stationWall(x, 21.5, 0.25, 0.25, this._std(0x303b42), 0.9);
      for (const x of [-20, -16, -12, -8, 8, 12, 16, 20]) this._box(this.level, 0.08, 0.008, 4.5, this._std(0xdfd6ac), x, 0.016, 26);
      const carStart = this.level.children.length;
      this._patrolCollider = this._stationWall(10, 26, 1.9, 4.1, this._std(0xd5d9d9, 0.35, 0.4), 0.8);
      this._box(this.level, 1.65, 0.65, 2, this._std(0x314b5a, 0.3, 0.4), 10, 1.05, 25.8);
      this._box(this.level, 1.4, 0.12, 0.3, this._std(0x3f66b0), 10, 1.45, 25.8);
      this._stationSign('POLICE', 10, 0.55, 28.07, 1.5);
      this._patrolFallbacks = this.level.children.slice(carStart);
      for (const [x,z] of [[0,15],[-5,9],[15,12],[0,21]]) {
        const light = new THREE.PointLight(z > 19 ? 0xffd7a4 : 0xe7eef5, 28, 16, 1.7);
        light.position.set(x, 3, z); this.level.add(light);
        const fixture = this._box(this.level, 1.5, 0.06, 0.2, new THREE.MeshBasicMaterial({color:0xe8edf0}), x, 3.3, z);
        if (z < 19) (this._ceilingFallbacks ||= []).push(fixture);
      }
      buildStationLayout(this);
    },

    _setOfficeDoor(open) {
      this.station.doorOpen = open;
      this._officeDoor.rotation.y = open ? Math.PI / 2 : 0;
      this._officeDoor.updateMatrixWorld(true);
      this._doorCollider.setFromObject(this._officeDoor);
    },

    _stationPrompt(it) {
      const prompts = {
        reception: '[E] Greet Mokoena', stationDoor: `[E] ${this.station.doorOpen ? 'Close' : 'Open'} captain’s office door`,
        stationClosed: '[E] Closed wing',
        stationExit: '[E] Leave for GENESIS',
      };
      return prompts[it.kind];
    },

    _stationInteract(it) {
      if (it.kind === 'reception') {
        this.station.checkedIn = true;
        this.station.evidenceHanded = true;
        this.station.inventory = Object.keys(this.collected).filter(id => this.collected[id]);
        this._toast('CONSTABLE D. MOKOENA — FRONT DESK', 'Morning, Detective. The lab is ready — through the marked door on the left.', 3500);
      } else if (it.kind === 'stationDoor') {
        const p = this._stationPlayer?.pos;
        if (p && Math.abs(p.x - 10.15) < 0.65 && p.z > 10.5 && p.z < 13.5) {
          this._toast('DOORWAY', 'Step clear of the doorway to move the door.', 2500);
        } else this._setOfficeDoor(!this.station.doorOpen);
      } else if (it.kind === 'stationClosed') {
        this._toast(it.label, CLOSED_MESSAGE, 4000);
      } else if (it.kind === 'stationExit') {
        if (this.station.departureReady && typeof window.__switchLevel === 'function') window.__switchLevel(3);
      } else return false;
      this._refreshCounter(); return true;
    },

    _stationCanDepart() {
      return this.station.checkedIn && REPORTS.every(k => this.reports[k]?.signed);
    },

    _updateStation(dt, player) {
      this._stationPlayer = player;
      updateStationLife(this, dt, player);
      if (!player || window.__uiCapture) return;
      const route = this._closedRoutes.find(r => Math.hypot(player.pos.x-r.x, player.pos.z-r.z) < 1.4);
      if (route && this._nearClosed !== route) this._toast(route.label, CLOSED_MESSAGE, 4000);
      this._nearClosed = route;
    },
  });
}

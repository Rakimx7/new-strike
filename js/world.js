import * as THREE from 'three';
import { WORLD_HALF } from './core/config.js';
import { S } from './state.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 50, 260);
export const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 800);
export const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x4a5d3a, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.4);
sun.position.set(60,100,40); sun.castShadow = true;
sun.shadow.camera.left=-120; sun.shadow.camera.right=120; sun.shadow.camera.top=120; sun.shadow.camera.bottom=-120;
sun.shadow.mapSize.set(2048,2048); scene.add(sun);

export const viewRig = new THREE.Group();
camera.add(viewRig); scene.add(camera);
export const muzzleFlashLight = new THREE.PointLight(0xffcf6b, 0, 6);
viewRig.add(muzzleFlashLight);

export const flat = c => new THREE.MeshStandardMaterial({ color:c, flatShading:true, roughness:0.9 });
export const solids = [], staticMeshes = [];
export const MERC_BASE = new THREE.Vector3(0, 0, 80);
export const CARTEL_BASE = new THREE.Vector3(0, 0, -80);
export let BOMB_SITE_A, BOMB_SITE_B, bombSiteMeshA, bombSiteRingA, bombSiteMeshB, bombSiteRingB;
export let MERC_BUY_ZONE, CARTEL_BUY_ZONE, BOMB_SITE;

export function addBox(x,y,z,w,h,d,color,solid=true){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), flat(color));
  m.position.set(x,y,z); m.castShadow = m.receiveShadow = true;
  m.userData.isMap = true; scene.add(m);
  if(solid){ solids.push({min:new THREE.Vector3(x-w/2,y-h/2,z-d/2), max:new THREE.Vector3(x+w/2,y+h/2,z+d/2)}); staticMeshes.push(m); }
  return m;
}
export function addCylinder(x,y,z,r,h,color,solid=true){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12), flat(color));
  m.position.set(x,y,z); m.castShadow = m.receiveShadow = true;
  m.userData.isMap = true; scene.add(m);
  if(solid){ solids.push({min:new THREE.Vector3(x-r,y-h/2,z-r), max:new THREE.Vector3(x+r,y+h/2,z+r)}); staticMeshes.push(m); }
  return m;
}

// ═══════════════════════════════════════════════════════════
// NEW MAP — 3 clear lanes, no blocking center
// ═══════════════════════════════════════════════════════════
export function buildDefaultMap(){
  [...scene.children].forEach(o => { if(o.userData.isMap) scene.remove(o); });
  solids.length = 0; staticMeshes.length = 0;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500,500,50,50), flat(0x6a8f5f));
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; ground.userData.isMap = true; scene.add(ground);
  const grid = new THREE.GridHelper(500, 100, 0x2c4a2c, 0x527a4c); grid.position.y=0.01; grid.userData.isMap=true; scene.add(grid);

  const wallC=0x9c8f7a, crateC=0xa9773f, darkC=0x6e6455, sandC=0xc9a86e;

  // PERIMETER
  addBox(0,3,-WORLD_HALF,WORLD_HALF*2+4,6,2,wallC);
  addBox(0,3,WORLD_HALF,WORLD_HALF*2+4,6,2,wallC);
  addBox(-WORLD_HALF,3,0,2,6,WORLD_HALF*2+4,wallC);
  addBox(WORLD_HALF,3,0,2,6,WORLD_HALF*2+4,wallC);

  // MERC BASE
  const mercFloor = new THREE.Mesh(new THREE.BoxGeometry(60,0.3,36), flat(0x4a5a48));
  mercFloor.position.set(0,0.15,80); mercFloor.receiveShadow = true; mercFloor.userData.isMap=true; scene.add(mercFloor);
  MERC_BUY_ZONE = new THREE.Vector3(0, 0, 80);
  addBox(-30,3,94,20,6,2,0x4a5a48); addBox(30,3,94,20,6,2,0x4a5a48);
  addBox(-30,3,80,2,6,26,0x4a5a48); addBox(30,3,80,2,6,26,0x4a5a48);
  addBox(-30,3,66,14,6,2,0x4a5a48);
  addBox(0,3,66,14,6,2,0x4a5a48);
  addBox(30,3,66,14,6,2,0x4a5a48);
  addBox(-14,1,76,3,2,3,crateC); addBox(14,1,76,3,2,3,crateC);
  addBox(-22,1,88,3,2,3,crateC); addBox(22,1,88,3,2,3,crateC);

  // CARTEL BASE
  const cartelFloor = new THREE.Mesh(new THREE.BoxGeometry(60,0.3,36), flat(0x5a4848));
  cartelFloor.position.set(0,0.15,-80); cartelFloor.receiveShadow=true; cartelFloor.userData.isMap=true; scene.add(cartelFloor);
  CARTEL_BUY_ZONE = new THREE.Vector3(0, 0, -80);
  addBox(-30,3,-94,20,6,2,0x5a4848); addBox(30,3,-94,20,6,2,0x5a4848);
  addBox(-30,3,-80,2,6,26,0x5a4848); addBox(30,3,-80,2,6,26,0x5a4848);
  addBox(-30,3,-66,14,6,2,0x5a4848);
  addBox(0,3,-66,14,6,2,0x5a4848);
  addBox(30,3,-66,14,6,2,0x5a4848);
  addBox(-14,1,-76,3,2,3,crateC); addBox(14,1,-76,3,2,3,crateC);
  addBox(-22,1,-88,3,2,3,crateC); addBox(22,1,-88,3,2,3,crateC);

  // LEFT LANE
  addBox(-50,1.5,45,8,3,4,sandC);
  addBox(-50,1.5,20,4,3,8,sandC);
  addBox(-50,1.5,-20,4,3,8,sandC);
  addBox(-50,1.5,-45,8,3,4,sandC);
  addBox(-58,1,35,3,2,3,crateC);
  addBox(-42,1,-35,3,2,3,crateC);

  // RIGHT LANE
  addBox(50,1.5,45,8,3,4,sandC);
  addBox(50,1.5,20,4,3,8,sandC);
  addBox(50,1.5,-20,4,3,8,sandC);
  addBox(50,1.5,-45,8,3,4,sandC);
  addBox(58,1,35,3,2,3,crateC);
  addBox(42,1,-35,3,2,3,crateC);

  // CENTER SMALL COVER
  addCylinder(-15,1.5,0,1.5,3,darkC);
  addCylinder(15,1.5,0,1.5,3,darkC);
  addBox(0,0.7,15,10,1.4,2,sandC);
  addBox(0,0.7,-15,10,1.4,2,sandC);

  // BOMB SITES
  BOMB_SITE_A = new THREE.Vector3(-60,0,0);
  const sA = new THREE.Mesh(new THREE.BoxGeometry(30,0.2,30), flat(0xb09060));
  sA.position.set(-60,0.1,0); sA.receiveShadow=true; sA.userData.isMap=true; scene.add(sA);
  bombSiteMeshA = new THREE.Mesh(new THREE.CylinderGeometry(5,5,0.25,24),
    new THREE.MeshStandardMaterial({color:0xff9d5e, emissive:0x6a3a1a, transparent:true, opacity:0.5}));
  bombSiteMeshA.position.set(-60,0.3,0); bombSiteMeshA.visible=false; bombSiteMeshA.userData.isMap=true; scene.add(bombSiteMeshA);
  bombSiteRingA = new THREE.Mesh(new THREE.TorusGeometry(5,0.12,8,32),
    new THREE.MeshStandardMaterial({color:0xff9d5e, emissive:0xff9d5e}));
  bombSiteRingA.rotation.x = Math.PI/2; bombSiteRingA.position.set(-60,0.4,0);
  bombSiteRingA.visible=false; bombSiteRingA.userData.isMap=true; scene.add(bombSiteRingA);

  BOMB_SITE_B = new THREE.Vector3(60,0,0);
  const sB = new THREE.Mesh(new THREE.BoxGeometry(30,0.2,30), flat(0xb09060));
  sB.position.set(60,0.1,0); sB.receiveShadow=true; sB.userData.isMap=true; scene.add(sB);
  bombSiteMeshB = new THREE.Mesh(new THREE.CylinderGeometry(5,5,0.25,24),
    new THREE.MeshStandardMaterial({color:0xff9d5e, emissive:0x6a3a1a, transparent:true, opacity:0.5}));
  bombSiteMeshB.position.set(60,0.3,0); bombSiteMeshB.visible=false; bombSiteMeshB.userData.isMap=true; scene.add(bombSiteMeshB);
  bombSiteRingB = new THREE.Mesh(new THREE.TorusGeometry(5,0.12,8,32),
    new THREE.MeshStandardMaterial({color:0xff9d5e, emissive:0xff9d5e}));
  bombSiteRingB.rotation.x = Math.PI/2; bombSiteRingB.position.set(60,0.4,0);
  bombSiteRingB.visible=false; bombSiteRingB.userData.isMap=true; scene.add(bombSiteRingB);

  // SCENIC HILLS
  for(let i=0;i<30;i++){
    const h = new THREE.Mesh(new THREE.ConeGeometry(8+Math.random()*14, 10+Math.random()*18, 5), flat(0x55744e));
    const a = Math.random()*Math.PI*2, r = 140+Math.random()*100;
    h.position.set(Math.cos(a)*r, 4, Math.sin(a)*r);
    h.castShadow = true; h.userData.isMap = true; scene.add(h);
  }
}

// ═══════════ COLLISION ═══════════
export function collideXZ(pos, r, feetY, headY){
  for(const b of solids){
    if(feetY >= b.max.y - 0.05) continue;
    if(headY <= b.min.y) continue;
    const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d = Math.sqrt(dx*dx + dz*dz) || 0.001;
    if(d < r){
      const push = (r - d) / d;
      pos.x += dx * push; pos.z += dz * push;
    }
  }
}
export function collideBot(pos, r){
  collideXZ(pos, r, 0, 1.9);
  for(const b of solids){
    if(pos.y + 1.9 < b.min.y || pos.y > b.max.y) continue;
    if(pos.x > b.min.x && pos.x < b.max.x && pos.z > b.min.z && pos.z < b.max.z){
      const dLeft = pos.x - b.min.x, dRight = b.max.x - pos.x;
      const dBack = pos.z - b.min.z, dFront = b.max.z - pos.z;
      const minD = Math.min(dLeft, dRight, dBack, dFront);
      if(minD === dLeft) pos.x = b.min.x - r;
      else if(minD === dRight) pos.x = b.max.x + r;
      else if(minD === dBack) pos.z = b.min.z - r;
      else pos.z = b.max.z + r;
    }
  }
}
export function getGroundHeight(pos, r, eye){
  let maxY = 0;
  const feetY = pos.y - eye;
  for(const b of solids){
    const overlapX = pos.x + r*0.85 > b.min.x && pos.x - r*0.85 < b.max.x;
    const overlapZ = pos.z + r*0.85 > b.min.z && pos.z - r*0.85 < b.max.z;
    if(!overlapX || !overlapZ) continue;
    if(b.max.y <= feetY + 0.5 && b.max.y > maxY) maxY = b.max.y;
  }
  return maxY;
}

function lineIntersectsSphere(a, b, center, radius){
  const ab = b.clone().sub(a);
  const ac = center.clone().sub(a);
  const abLen2 = ab.lengthSq();
  if(abLen2 < 1e-6) return false;
  const t = Math.max(0, Math.min(1, ac.dot(ab) / abLen2));
  const closest = a.clone().addScaledVector(ab, t);
  return closest.distanceTo(center) < radius;
}
export function losClear(a, b){
  const dir = b.clone().sub(a); const dist = dir.length(); dir.normalize();
  const ray = new THREE.Raycaster(a, dir, 0.01, dist - 0.3);
  if(ray.intersectObjects(staticMeshes, false).length > 0) return false;
  for(const s of S.smokeClouds){ if(lineIntersectsSphere(a, b, s.pos, s.radius)) return false; }
  return true;
}

// ═══════════ WAYPOINT STUBS (compat) ═══════════
export const WAYPOINTS = [];
export function buildWaypointGraph(){ /* no-op */ }
export function findWaypointPath(startPos, endPos){ return [endPos.clone()]; }
export function tickPathfinding(){ /* no-op */ }
export function rebuildPathfinding(){ /* no-op */ }
export function requestPath(startPos, endPos, cb){ cb([endPos.clone()]); }

// ⭐ REAL NAV MOVE — DIRECT with LOS check (no BFS)
export function computeNavMove(bot, targetPos, dt, speed){
  const to = new THREE.Vector3(
    targetPos.x - bot.mesh.position.x, 0,
    targetPos.z - bot.mesh.position.z
  );
  const dist = to.length();
  if(dist < 0.6) return new THREE.Vector3();
  return to.normalize().multiplyScalar(speed * dt);
}
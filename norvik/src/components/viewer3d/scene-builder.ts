import * as THREE from 'three';
import type { KitchenPlan, PlacedModule, Anchor } from '@/algorithm/types';
import {
  createLowerCabinet,
  createUpperCabinet,
  createCornerCabinet,
  createTallCabinet,
  createFillerPanel,
  createPlinth,
  createSink,
  createCooktop,
  mm,
} from './procedural-models';
import {
  createFloorTexture,
  createWallTexture,
  createTileTexture,
} from './texture-factory';
import { UPPER_HEIGHT, UPPER_DEPTH, UPPER_Y, COUNTERTOP_TOP as COUNTERTOP_TOP_MM, WALL_THICKNESS, BASEBOARD_HEIGHT, BACKSPLASH_HEIGHT } from '@/algorithm/constants';
import { gltfLoader, proxyGlbUrl, enableShadows } from './three-utils';
import { disposeObject } from './dispose';

export interface WallAnchors {
  wallId: string;
  anchors: Anchor[];
}

export interface RoomConfig {
  roomWidth: number;  // mm
  roomDepth: number;  // mm
  wallHeight: number; // mm
}
// ── Room geometry ───────────────────────────────────────────
function createFloor(roomWidth: number, roomDepth: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(mm(roomWidth), mm(roomDepth));
  const mat = new THREE.MeshStandardMaterial({
    map: createFloorTexture(),
    roughness: 0.7,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(geo, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(mm(roomWidth) / 2, 0, mm(roomDepth) / 2);
  floor.receiveShadow = true;
  floor.name = 'floor';
  return floor;
}

const WT = WALL_THICKNESS; // shorthand

function createWallMesh(
  width: number,
  height: number,
  position: THREE.Vector3,
  rotation: THREE.Euler,
  name: string,
  innerFace: '+z' | '-z' = '+z',
): THREE.Mesh {
  const t = mm(WALL_THICKNESS);
  const geo = new THREE.BoxGeometry(mm(width), mm(height), t);
  const wallTexture = createWallTexture();

  const innerMat = new THREE.MeshStandardMaterial({
    map: wallTexture,
    roughness: 0.95,
    metalness: 0.0,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xEDE8DF,
    roughness: 0.95,
    metalness: 0.0,
  });

  const materials = [
    edgeMat, // +x
    edgeMat, // -x
    edgeMat, // +y
    edgeMat, // -y
    innerFace === '+z' ? innerMat : edgeMat, // +z
    innerFace === '-z' ? innerMat : edgeMat, // -z
  ];

  const wall = new THREE.Mesh(geo, materials);
  wall.position.copy(position);
  wall.rotation.copy(rotation);
  wall.castShadow = true;
  wall.receiveShadow = true;
  wall.name = name;
  return wall;
}

function createBaseboard(
  length: number,
  position: THREE.Vector3,
  rotation: THREE.Euler,
): THREE.Mesh {
  const h = mm(BASEBOARD_HEIGHT);
  const d = mm(12);
  const geo = new THREE.BoxGeometry(mm(length), h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xF0EBE3,
    roughness: 0.6,
    metalness: 0.0,
  });
  const board = new THREE.Mesh(geo, mat);
  board.position.copy(position);
  board.rotation.copy(rotation);
  board.castShadow = true;
  board.receiveShadow = true;
  board.name = 'baseboard';
  return board;
}

function createBacksplash(width: number, position: THREE.Vector3, rotation?: THREE.Euler): THREE.Mesh {
  const splashHeight = mm(BACKSPLASH_HEIGHT);
  const geo = new THREE.PlaneGeometry(mm(width), splashHeight);
  const mat = new THREE.MeshStandardMaterial({
    map: createTileTexture(),
    roughness: 0.3,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  if (rotation) mesh.rotation.copy(rotation);
  mesh.receiveShadow = true;
  mesh.name = 'backsplash';
  return mesh;
}

// ── Module placement ────────────────────────────────────────

/**
 * Create the 3D object for a module based on its type.
 */
function createModuleObject(mod: PlacedModule): { object: THREE.Group | THREE.Mesh; depth: number } {
  const isUpper = mod.type === 'upper';
  const depth = mod.depth || (isUpper ? UPPER_DEPTH : 560);

  if (mod.type === 'filler') {
    const mesh = createFillerPanel(mod.width, mod.height);
    mesh.userData = { moduleId: mod.id, type: mod.type };
    mesh.name = `placeholder-${mod.id}`;
    return { object: mesh, depth };
  }

  let group: THREE.Group;
  if (mod.type === 'tall') {
    group = createTallCabinet(mod.width, depth, mod.height);
  } else if (isUpper) {
    group = createUpperCabinet(mod.width, depth, mod.height || UPPER_HEIGHT);
  } else {
    group = createLowerCabinet(mod.width, depth, mod.height);
  }

  group.userData = { moduleId: mod.id, type: mod.type };
  group.name = `placeholder-${mod.id}`;
  return { object: group, depth };
}

/**
 * Place a module on the back wall (along X axis).
 */
function placeBackWallModule(mod: PlacedModule): THREE.Group | THREE.Mesh {
  const xPos = mm(mod.x + mod.width / 2);
  const { object, depth } = createModuleObject(mod);

  if (mod.type === 'filler') {
    object.position.x = xPos;
  } else {
    const y = mod.type === 'upper' ? mm(UPPER_Y) : 0;
    object.position.set(xPos, y, mm(depth) / 2);
  }

  return object;
}

/**
 * Place a module on the left wall (along Z axis, rotated -90°).
 */
function placeLeftWallModule(mod: PlacedModule): THREE.Group | THREE.Mesh {
  const zPos = mm(mod.x + mod.width / 2);
  const { object, depth } = createModuleObject(mod);

  if (mod.type === 'filler') {
    object.position.set(0, 0, zPos);
  } else {
    const y = mod.type === 'upper' ? mm(UPPER_Y) : 0;
    object.position.set(mm(depth) / 2, y, zPos);
  }

  object.rotation.y = -Math.PI / 2;
  return object;
}

// ── Lighting ────────────────────────────────────────────────

function setupLighting(scene: THREE.Scene, roomWidth: number, roomDepth: number, wallHeight: number) {
  const rw = mm(roomWidth);
  const rd = mm(roomDepth);
  const wh = mm(wallHeight);

  // Warm ambient — fills the room with soft base light
  const ambient = new THREE.AmbientLight(0xFFF8F0, 0.5);
  scene.add(ambient);

  // Hemisphere light — sky/ground color contrast for volume
  const hemi = new THREE.HemisphereLight(0xF5EDE0, 0xD4C8B8, 0.4);
  hemi.position.set(0, wh, 0);
  scene.add(hemi);

  // Key light — warm directional from upper-right-front (like window light)
  const key = new THREE.DirectionalLight(0xFFF5E6, 0.7);
  key.position.set(rw * 0.7, wh * 0.9, rd * 1.2);
  key.target.position.set(rw * 0.4, 0, rd * 0.2);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 10;
  key.shadow.camera.left = -rw;
  key.shadow.camera.right = rw;
  key.shadow.camera.top = wh;
  key.shadow.camera.bottom = -0.1;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);

  // Fill light — softer, from the left side, slightly cool
  const fill = new THREE.DirectionalLight(0xE8F0FF, 0.25);
  fill.position.set(-rw * 0.3, wh * 0.6, rd * 0.5);
  scene.add(fill);

  // Subtle ceiling bounce — point light from above center
  const ceiling = new THREE.PointLight(0xFFF8F0, 0.3, rw * 3);
  ceiling.position.set(rw / 2, wh - 0.05, rd / 2);
  scene.add(ceiling);
}

// ── GLB model loading ────────────────────────────────────────
function removeSceneObjectByName(scene: THREE.Scene, name: string): void {
  const obj = scene.getObjectByName(name);
  if (!obj) return;
  disposeObject(obj);
  scene.remove(obj);
}

function loadGlbModule(
    mod: PlacedModule,
    scene: THREE.Scene,
    wall: 'back' | 'left' | 'corner',
): Promise<void> {
  if (!mod.glbFile) return Promise.resolve();

  const url = proxyGlbUrl(mod.glbFile);

  return new Promise((resolve) => {
    gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          const isUpper = mod.type === 'upper';
          const targetW = mm(mod.width);

          // На случай повторной загрузки того же модуля
          removeSceneObjectByName(scene, `glb-${mod.id}`);

          enableShadows(model);

          // Сырым bbox меряем до scale
          const rawBox = new THREE.Box3().setFromObject(model);
          const rawSize = rawBox.getSize(new THREE.Vector3());

          if (!Number.isFinite(rawSize.x) || rawSize.x <= 1e-6) {
            console.warn(`[GLB] Invalid raw width for ${mod.id}`, rawSize);
            resolve();
            return;
          }

          // Подгоняем ширину модели под ширину модуля
          const uniformScale = targetW / rawSize.x;
          model.scale.setScalar(uniformScale);

          // После scale пересчитываем bbox
          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledSize = scaledBox.getSize(new THREE.Vector3());
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

          // Центруем модель относительно wrapper:
          // x/z по центру, y ставим на пол
          model.position.set(
              model.position.x - scaledCenter.x,
              model.position.y - scaledBox.min.y,
              model.position.z - scaledCenter.z,
          );

          const wrapper = new THREE.Group();
          wrapper.name = `glb-${mod.id}`;
          wrapper.userData = {
            moduleId: mod.id,
            type: mod.type,
            wall,
            glbFile: mod.glbFile,
          };
          wrapper.add(model);

          const y = isUpper ? mm(UPPER_Y) : 0;

          if (wall === 'corner') {
            wrapper.position.set(0, y, 0);
          } else if (wall === 'left') {
            const zPos = mm(mod.x + mod.width / 2);
            wrapper.position.set(scaledSize.z / 2, y, zPos);
            wrapper.rotation.y = -Math.PI / 2;
          } else {
            const xPos = mm(mod.x + mod.width / 2);
            wrapper.position.set(xPos, y, scaledSize.z / 2);
          }

          scene.add(wrapper);
          resolve();
        },
        undefined,
        (err) => {
          console.warn(`[GLB] Failed to load ${mod.id} from ${url}`, err);
          resolve();
        },
    );
  });
}

// ── Main builder ────────────────────────────────────────────

export interface BuildSceneResult {
  scene: THREE.Scene;
  loadGlbModels: () => Promise<void>;
}

export function buildScene(plan: KitchenPlan, roomConfig: RoomConfig, wallAnchors?: WallAnchors[]): BuildSceneResult {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF5F1EB);

  const { roomWidth, roomDepth, wallHeight } = roomConfig;
  const rw = mm(roomWidth);
  const rd = mm(roomDepth);
  const wh = mm(wallHeight);

  // Floor
  scene.add(createFloor(roomWidth, roomDepth));

  // Walls — positioned so inner face aligns with room boundary
  const halfT = mm(WT) / 2;

  // Back wall: inner face at z=0, wall center at z = -halfT
  scene.add(
    createWallMesh(
      roomWidth + WT * 2, wallHeight,
      new THREE.Vector3(rw / 2, wh / 2, -halfT),
      new THREE.Euler(0, 0, 0),
      'back-wall',
      '+z',
    ),
  );

  // Left wall: inner face at x=0, wall center at x = -halfT
  scene.add(
    createWallMesh(
      roomDepth + WT, wallHeight,
      new THREE.Vector3(-halfT, wh / 2, rd / 2),
      new THREE.Euler(0, Math.PI / 2, 0),
      'left-wall',
      '+z',
    ),
  );

  // Right wall: inner face at x=rw, wall center at x = rw + halfT
  scene.add(
    createWallMesh(
      roomDepth + WT, wallHeight,
      new THREE.Vector3(rw + halfT, wh / 2, rd / 2),
      new THREE.Euler(0, -Math.PI / 2, 0),
      'right-wall',
      '+z',
    ),
  );

  // Baseboards — flush against inner wall face
  const bbH = mm(40); // half baseboard height
  const bbD = mm(6);  // half baseboard depth offset from wall
  // Back wall baseboard
  scene.add(createBaseboard(
    roomWidth,
    new THREE.Vector3(rw / 2, bbH, bbD),
    new THREE.Euler(0, 0, 0),
  ));
  // Left wall baseboard
  scene.add(createBaseboard(
    roomDepth,
    new THREE.Vector3(bbD, bbH, rd / 2),
    new THREE.Euler(0, Math.PI / 2, 0),
  ));
  // Right wall baseboard
  scene.add(createBaseboard(
    roomDepth,
    new THREE.Vector3(rw - bbD, bbH, rd / 2),
    new THREE.Euler(0, Math.PI / 2, 0),
  ));

  // Backsplash (tile strip behind countertop on back wall)
  const backsplashY = mm(UPPER_Y - 100);
  scene.add(
    createBacksplash(
      roomWidth,
      new THREE.Vector3(rw / 2, backsplashY, mm(2)),
    ),
  );

  // ── Determine which walls go where ──
  // Convention: walls[0] = back wall (along X), walls[1] = left wall (along Z) for L-shaped
  const isLShaped = plan.walls.length >= 2;

  // Collect all placed modules with their wall context for GLB loading
  const glbCandidates: { mod: PlacedModule; wall: 'back' | 'left' | 'corner' }[] = [];

  // ── Place cabinets ──

  for (let wi = 0; wi < plan.walls.length; wi++) {
    const wallPlan = plan.walls[wi];
    const isLeftWall = isLShaped && wi === 1;

    for (const mod of wallPlan.modules) {
      if (mod.glbFile) {
        glbCandidates.push({ mod, wall: isLeftWall ? 'left' : 'back' });
        continue;
      }

      scene.add(isLeftWall ? placeLeftWallModule(mod) : placeBackWallModule(mod));
    }
  }

  // ── Place corner cabinets ──

  if (plan.cornerModules && plan.cornerModules.length > 0) {
    for (const cornerMod of plan.cornerModules) {
      if (cornerMod.glbFile) {
        glbCandidates.push({ mod: cornerMod, wall: 'corner' });
        continue;
      }

      const cornerGroup = createCornerCabinet(
        cornerMod.width,
        cornerMod.depth,
        cornerMod.height,
      );

      cornerGroup.position.set(0, 0, 0);
      cornerGroup.userData = { moduleId: cornerMod.id, type: 'corner' };
      scene.add(cornerGroup);
    }
  }

  // Left wall backsplash for L-shaped layouts
  if (isLShaped) {
    scene.add(
      createBacksplash(
        roomDepth,
        new THREE.Vector3(mm(2), backsplashY, rd / 2),
        new THREE.Euler(0, Math.PI / 2, 0),
      ),
    );
  }

  // Plinth strip — back wall modules
  const backWallLowers = plan.walls[0]?.modules.filter(
    (m) => m.type === 'lower' || m.type === 'tall',
  ) ?? [];
  if (backWallLowers.length > 0) {
    const minX = Math.min(...backWallLowers.map((m) => m.x));
    const maxX = Math.max(...backWallLowers.map((m) => m.x + m.width));
    const totalWidth = maxX - minX;
    const plinth = createPlinth(totalWidth);
    plinth.position.x = mm(minX + totalWidth / 2);
    plinth.position.z = mm(280);
    scene.add(plinth);
  }

  // Plinth strip — left wall modules (if L-shaped)
  if (isLShaped && plan.walls[1]) {
    const leftWallLowers = plan.walls[1].modules.filter(
      (m) => m.type === 'lower' || m.type === 'tall',
    );
    if (leftWallLowers.length > 0) {
      const minZ = Math.min(...leftWallLowers.map((m) => m.x));
      const maxZ = Math.max(...leftWallLowers.map((m) => m.x + m.width));
      const totalWidth = maxZ - minZ;
      const plinth = createPlinth(totalWidth);
      plinth.rotation.y = -Math.PI / 2;
      plinth.position.set(mm(280), 0, mm(minZ + totalWidth / 2));
      scene.add(plinth);
    }
  }

  // ── Place appliances (sink, cooktop) on countertop at anchor positions ──
  if (wallAnchors && wallAnchors.length > 0) {
    const ctTop = mm(COUNTERTOP_TOP_MM);
    const CT_DEPTH_Z = mm(280);
    for (let wi = 0; wi < wallAnchors.length; wi++) {
      const wa = wallAnchors[wi];
      const isLeftWall = isLShaped && wi === 1;

      for (const anchor of wa.anchors) {
        // Skip procedural appliance if the module at this position has a GLB
        const wallModules = plan.walls[wi]?.modules ?? [];
        const anchorCenter = anchor.position + anchor.width / 2;


        let appliance: THREE.Group | null = null;

        if (anchor.type === 'sink') {
          appliance = createSink(anchor.width);
        } else if (anchor.type === 'cooktop') {
          appliance = createCooktop(anchor.width);
        }

        if (!appliance) continue;

        if (isLeftWall) {
          const zPos = mm(anchor.position + anchor.width / 2);
          appliance.position.set(CT_DEPTH_Z, ctTop, zPos);
          appliance.rotation.y = -Math.PI / 2;
        } else {
          const xPos = mm(anchor.position + anchor.width / 2);
          appliance.position.set(xPos, ctTop, CT_DEPTH_Z);
        }

        appliance.name = `appliance-${anchor.type}-${wi}`;
        scene.add(appliance);
      }
    }
  }

  // Lighting
  setupLighting(scene, roomWidth, roomDepth, wallHeight);

  // Async GLB loader — replaces procedural placeholders with real models
  const loadGlbModels = async (): Promise<void> => {
    const promises = glbCandidates.map(({ mod, wall }) =>
      loadGlbModule(mod, scene, wall),
    );
    await Promise.all(promises);
  };

  return { scene, loadGlbModels };
}

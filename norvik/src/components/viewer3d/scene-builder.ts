import * as THREE from 'three';
import type { KitchenPlan, PlacedModule, Anchor } from '@/algorithm/types';
import {
  createLowerCabinet,
  createUpperCabinet,
  createCornerCabinet,
  createTallCabinet,
  createFillerPanel,
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

// ── Text labels ─────────────────────────────────────────────

/** Create a canvas texture with text for use as a billboard label. */
function createLabelTexture(text: string, bgColor = 'rgba(0,0,0,0.7)', fgColor = '#fff'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const fontSize = 28;
  const padding = 12;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + padding * 2;

  // Background pill
  ctx.fillStyle = bgColor;
  const r = 6;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, r);
  ctx.fill();

  // Text
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = fgColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

/** Create a billboard sprite label positioned at (x, y, z). */
function createLabel(text: string, x: number, y: number, z: number, bgColor?: string, fgColor?: string): THREE.Sprite {
  const texture = createLabelTexture(text, bgColor, fgColor);
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.name = `label-${text}`;

  // Scale sprite proportional to canvas aspect ratio
  const aspect = texture.image.width / texture.image.height;
  const labelHeight = 0.06; // meters
  sprite.scale.set(labelHeight * aspect, labelHeight, 1);
  sprite.position.set(x, y, z);
  return sprite;
}

// ── Module placement ────────────────────────────────────────

/**
 * Create the 3D object for a module based on its type.
 */
function createModuleObject(mod: PlacedModule): { object: THREE.Group | THREE.Mesh; depth: number } {
  const isUpper = mod.type === 'upper' || mod.type === 'antresol';
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
function getModuleY(mod: PlacedModule): number {
  if (mod.yOffset != null) return mm(mod.yOffset);
  if (mod.type === 'upper') return mm(UPPER_Y);
  return 0;
}

function placeBackWallModule(mod: PlacedModule): THREE.Group | THREE.Mesh {
  const xPos = mm(mod.x + mod.width / 2);
  const { object, depth } = createModuleObject(mod);

  if (mod.type === 'filler') {
    object.position.x = xPos;
  } else {
    object.position.set(xPos, getModuleY(mod), mm(depth) / 2);
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
    object.position.set(mm(depth) / 2, getModuleY(mod), zPos);
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

interface ScaledGlb {
  model: THREE.Group;
  scaledSize: THREE.Vector3;
}

/**
 * Load a GLB, scale it to targetWidth, and center the model at origin.
 * Returns null if the model has invalid geometry.
 */
function loadAndScaleGlb(
  url: string,
  targetWidth: number,
  label: string,
): Promise<ScaledGlb | null> {
  return new Promise((resolve) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        enableShadows(model);

        const rawSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        if (!Number.isFinite(rawSize.x) || rawSize.x <= 1e-6) {
          console.warn(`[GLB] Invalid raw width for ${label}`, rawSize);
          resolve(null);
          return;
        }

        model.scale.setScalar(targetWidth / rawSize.x);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        model.position.set(
          model.position.x - scaledCenter.x,
          model.position.y - scaledBox.min.y,
          model.position.z - scaledCenter.z,
        );

        resolve({ model, scaledSize });
      },
      undefined,
      (err) => {
        console.warn(`[GLB] Failed to load ${label} from ${url}`, err);
        resolve(null);
      },
    );
  });
}

async function loadGlbModule(
  mod: PlacedModule,
  scene: THREE.Scene,
  wall: 'back' | 'left' | 'corner',
): Promise<void> {
  if (!mod.glbFile) return;

  const result = await loadAndScaleGlb(proxyGlbUrl(mod.glbFile), mm(mod.width), mod.id);
  if (!result) return;

  removeSceneObjectByName(scene, `glb-${mod.id}`);
  removeSceneObjectByName(scene, `placeholder-${mod.id}`);

  const wrapper = new THREE.Group();
  wrapper.name = `glb-${mod.id}`;
  wrapper.userData = { moduleId: mod.id, type: mod.type, wall, glbFile: mod.glbFile };
  wrapper.add(result.model);

  const y = getModuleY(mod);

  if (wall === 'corner') {
    wrapper.position.set(0, y, 0);
  } else if (wall === 'left') {
    wrapper.position.set(result.scaledSize.z / 2, y, mm(mod.x + mod.width / 2));
    wrapper.rotation.y = -Math.PI / 2;
  } else {
    wrapper.position.set(mm(mod.x + mod.width / 2), y, result.scaledSize.z / 2);
  }
  wrapper.rotation.y = Math.PI;
  scene.add(wrapper);
}

async function loadApplianceGlb(
  anchor: Anchor,
  placeholderName: string,
  scene: THREE.Scene,
  wall: 'back' | 'left',
): Promise<void> {
  if (!anchor.glbFile) return;

  const result = await loadAndScaleGlb(proxyGlbUrl(anchor.glbFile), mm(anchor.width), `appliance-${anchor.type}`);
  if (!result) return;

  removeSceneObjectByName(scene, placeholderName);

  const wrapper = new THREE.Group();
  wrapper.name = placeholderName;
  wrapper.add(result.model);

  const depthZ = mm(280);

  if (wall === 'left') {
    wrapper.position.set(depthZ, 0, mm(anchor.position + anchor.width / 2));
    wrapper.rotation.y = -Math.PI / 2;
  } else {
    wrapper.position.set(mm(anchor.position + anchor.width / 2), 0, depthZ);
    wrapper.rotation.y = Math.PI;
  }

  scene.add(wrapper);
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

  /** Label Y offset above the module top (meters). */
  const LABEL_PAD = 0.05;

  for (let wi = 0; wi < plan.walls.length; wi++) {
    const wallPlan = plan.walls[wi];
    const isLeftWall = isLShaped && wi === 1;

    for (const mod of wallPlan.modules) {
      if (mod.glbFile) {
        glbCandidates.push({ mod, wall: isLeftWall ? 'left' : 'back' });
      } else {
        scene.add(isLeftWall ? placeLeftWallModule(mod) : placeBackWallModule(mod));
      }

      // Add article label above every module
      if (mod.article) {
        const labelY = mm(mod.yOffset ?? (mod.type === 'upper' ? UPPER_Y : 0)) + mm(mod.height) + LABEL_PAD;
        const depthZ = mm((mod.depth || (mod.type === 'upper' || mod.type === 'antresol' ? UPPER_DEPTH : 560)) / 2);
        if (isLeftWall) {
          scene.add(createLabel(mod.article, depthZ, labelY, mm(mod.x + mod.width / 2)));
        } else {
          scene.add(createLabel(mod.article, mm(mod.x + mod.width / 2), labelY, depthZ));
        }
      }
    }
  }

  // ── Place corner cabinets ──

  if (plan.cornerModules && plan.cornerModules.length > 0) {
    for (const cornerMod of plan.cornerModules) {
      if (cornerMod.glbFile) {
        glbCandidates.push({ mod: cornerMod, wall: 'corner' });
      } else {
        const cornerGroup = createCornerCabinet(
          cornerMod.width,
          cornerMod.depth,
          cornerMod.height,
        );

        cornerGroup.position.set(0, 0, 0);
        cornerGroup.userData = { moduleId: cornerMod.id, type: 'corner' };
        scene.add(cornerGroup);
      }

      // Corner label
      if (cornerMod.article) {
        const labelY = mm(cornerMod.height) + LABEL_PAD;
        scene.add(createLabel(cornerMod.article, mm(cornerMod.width / 2), labelY, mm(cornerMod.depth / 2)));
      }
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

  // Plinth strip removed — fridge/penal and lower cabinets share the same floor level

  // ── Place appliances (sink, cooktop) on countertop at anchor positions ──
  // Anchors with glbFile get async-loaded; procedural models serve as placeholders.
  const applianceGlbQueue: { anchor: Anchor; name: string; wall: 'back' | 'left' }[] = [];

  if (wallAnchors && wallAnchors.length > 0) {
    const ctTop = mm(COUNTERTOP_TOP_MM);
    const CT_DEPTH_Z = mm(280);
    for (let wi = 0; wi < wallAnchors.length; wi++) {
      const wa = wallAnchors[wi];
      const isLeftWall = isLShaped && wi === 1;

      for (const anchor of wa.anchors) {
        const applianceName = `appliance-${anchor.type}-${wi}`;

        // Procedural placeholder
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

        appliance.name = applianceName;
        scene.add(appliance);

        // Anchor type label above appliance
        const anchorLabel = anchor.type.charAt(0).toUpperCase() + anchor.type.slice(1);
        const anchorLabelY = ctTop + mm(60);
        if (isLeftWall) {
          const zPos = mm(anchor.position + anchor.width / 2);
          scene.add(createLabel(anchorLabel, CT_DEPTH_Z, anchorLabelY, zPos, 'rgba(30,100,200,0.8)'));
        } else {
          const xPos = mm(anchor.position + anchor.width / 2);
          scene.add(createLabel(anchorLabel, xPos, anchorLabelY, CT_DEPTH_Z, 'rgba(30,100,200,0.8)'));
        }

        // Queue GLB replacement if catalog model available
        if (anchor.glbFile) {
          applianceGlbQueue.push({
            anchor,
            name: applianceName,
            wall: isLeftWall ? 'left' : 'back',
          });
        }
      }
    }
  }

  // Lighting
  setupLighting(scene, roomWidth, roomDepth, wallHeight);

  // Async GLB loader — replaces procedural placeholders with real models
  const loadGlbModels = async (): Promise<void> => {
    const cabinetPromises = glbCandidates.map(({ mod, wall }) =>
      loadGlbModule(mod, scene, wall),
    );

    // Load appliance GLBs from catalog, replacing procedural placeholders
    const appliancePromises = applianceGlbQueue.map(({ anchor, name, wall }) =>
      loadApplianceGlb(anchor, name, scene, wall),
    );

    await Promise.all([...cabinetPromises, ...appliancePromises]);
  };

  return { scene, loadGlbModels };
}

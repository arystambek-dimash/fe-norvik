import * as THREE from 'three';

const COLORS = {
  cabinetBody: 0xC9A87C,    // warm natural wood
  cabinetDoor: 0xFFFFFF,    // white door face
  countertop: 0x3A3A3A,     // dark stone
  countertopEdge: 0x2E2E2E, // darker edge bevel
  handle: 0xA0A0A0,         // brushed metal
  filler: 0xBFA070,         // matching wood filler
  plinth: 0x7D6548,         // darker wood plinth
} as const;

/** Convert millimeters to Three.js units (meters). */
export function mm(value: number): number {
  return value / 1000;
}

function woodMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.0,
  });
}

function metalMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: COLORS.handle,
    roughness: 0.3,
    metalness: 0.8,
  });
}

function stoneMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.05,
  });
}

/** Shared countertop material — import and mutate directly to change all countertops at once. */
export const countertopMaterial = new THREE.MeshStandardMaterial({
  color: 0x3A3A3A,
  roughness: 0.4,
  metalness: 0.05,
});

/** Shared facade (door) material — mutate directly to change all door panels at once. */
export const facadeMaterial = new THREE.MeshStandardMaterial({
  color: COLORS.cabinetDoor,
  roughness: 0.65,
  metalness: 0.0,
});

export function createLowerCountertop(
  width: number,
  depth: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lower-countertop';

  const w = mm(width);
  const d = mm(depth);
  const h = mm(height);

  const ctOver = mm(25); // overhang
  const ctH = mm(32);

  const ctGeo = new THREE.BoxGeometry(w + ctOver * 0.5, ctH, d + ctOver);
  const countertop = new THREE.Mesh(ctGeo, countertopMaterial);
  countertop.position.set(0, h + ctH / 2, ctOver * 0.3);
  countertop.castShadow = true;
  countertop.receiveShadow = true;
  countertop.userData.isCountertop = true;
  group.add(countertop);

  const edgeGeo = new THREE.BoxGeometry(w + ctOver * 0.5, mm(4), mm(3));
  const edge = new THREE.Mesh(edgeGeo, stoneMaterial(COLORS.countertopEdge));
  edge.position.set(0, h + mm(2), d / 2 + ctOver + mm(1));
  edge.userData.isCountertop = true;
  group.add(edge);

  return group;
}

export function createCornerCountertop(
  width: number,
  depth: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'corner-countertop';

  const w = mm(width);
  const d = mm(depth);
  const h = mm(height);

  const ctOver = mm(25);
  const ctH = mm(32);
  const ctShape = new THREE.Shape();
  ctShape.moveTo(-ctOver * 0.3, -ctOver * 0.3);
  ctShape.lineTo(w + ctOver * 0.25, -ctOver * 0.3);
  ctShape.lineTo(w + ctOver * 0.25, d + ctOver);
  ctShape.lineTo(d + ctOver, d + ctOver);
  ctShape.lineTo(d + ctOver, w + ctOver * 0.25);
  ctShape.lineTo(-ctOver * 0.3, w + ctOver * 0.25);
  ctShape.lineTo(-ctOver * 0.3, -ctOver * 0.3);

  const ctGeo = new THREE.ExtrudeGeometry(ctShape, { depth: ctH, bevelEnabled: false });
  ctGeo.rotateX(-Math.PI / 2);

  const countertop = new THREE.Mesh(ctGeo, countertopMaterial);
  countertop.position.y = h;
  countertop.castShadow = true;
  countertop.receiveShadow = true;
  countertop.userData.isCountertop = true;
  group.add(countertop);

  return group;
}

/**
 * Lower cabinet: body + recessed door panel + handle bar + countertop with edge.
 * All input dimensions in mm.
 */
export function createLowerCabinet(
  width: number,
  depth: number,
  height: number,
  options?: {
    includeCountertop?: boolean;
  },
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lower-cabinet';

  const w = mm(width);
  const d = mm(depth);
  const h = mm(height);

  // Cabinet body (carcass)
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(bodyGeo, woodMaterial(COLORS.cabinetBody));
  body.position.set(0, h / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Door panel — slightly protruding from body, with subtle frame
  const doorMargin = mm(3);
  const doorW = w - doorMargin * 2;
  const doorH = h - doorMargin * 2;
  const doorGeo = new THREE.BoxGeometry(doorW, doorH, mm(3));
  const door = new THREE.Mesh(doorGeo, facadeMaterial);
  door.position.set(0, h / 2, d / 2 + mm(1));
  door.castShadow = true;
  group.add(door);

  // Recessed inner panel (creates frame illusion)
  const innerMargin = mm(18);
  const innerGeo = new THREE.BoxGeometry(
    doorW - innerMargin * 2,
    doorH - innerMargin * 2,
    mm(1.5),
  );
  const inner = new THREE.Mesh(innerGeo, woodMaterial(COLORS.cabinetBody));
  inner.position.set(0, h / 2, d / 2 + mm(3));
  group.add(inner);

  // Handle bar — horizontal metal bar
  const handleW = Math.min(mm(160), w * 0.4);
  const handleGeo = new THREE.CylinderGeometry(mm(4), mm(4), handleW, 8);
  handleGeo.rotateZ(Math.PI / 2); // horizontal
  const handle = new THREE.Mesh(handleGeo, metalMaterial());
  handle.position.set(0, h * 0.72, d / 2 + mm(14));
  handle.castShadow = true;
  group.add(handle);

  // Handle mounts (two small cylinders)
  const mountGeo = new THREE.CylinderGeometry(mm(3), mm(3), mm(12), 8);
  mountGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const mount = new THREE.Mesh(mountGeo, metalMaterial());
    mount.position.set(side * handleW / 2, h * 0.72, d / 2 + mm(8));
    group.add(mount);
  }

  // Countertop slab
  if (options?.includeCountertop !== false) {
    group.add(createLowerCountertop(width, depth, height));
  }

  return group;
}

/**
 * Upper (wall) cabinet: body + door panel + handle bar.
 */
export function createUpperCabinet(
  width: number,
  depth: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'upper-cabinet';

  const w = mm(width);
  const d = mm(depth);
  const h = mm(height);

  // Body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(bodyGeo, woodMaterial(COLORS.cabinetBody));
  body.position.set(0, h / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Door
  const doorMargin = mm(3);
  const doorGeo = new THREE.BoxGeometry(
    w - doorMargin * 2,
    h - doorMargin * 2,
    mm(3),
  );
  const door = new THREE.Mesh(doorGeo, facadeMaterial);
  door.position.set(0, h / 2, d / 2 + mm(1));
  door.castShadow = true;
  group.add(door);

  // Recessed inner panel
  const innerMargin = mm(16);
  const innerGeo = new THREE.BoxGeometry(
    w - doorMargin * 2 - innerMargin * 2,
    h - doorMargin * 2 - innerMargin * 2,
    mm(1.5),
  );
  const inner = new THREE.Mesh(innerGeo, woodMaterial(COLORS.cabinetBody));
  inner.position.set(0, h / 2, d / 2 + mm(3));
  group.add(inner);

  // Handle bar — horizontal, near bottom
  const handleW = Math.min(mm(130), w * 0.35);
  const handleGeo = new THREE.CylinderGeometry(mm(3.5), mm(3.5), handleW, 8);
  handleGeo.rotateZ(Math.PI / 2);
  const handle = new THREE.Mesh(handleGeo, metalMaterial());
  handle.position.set(0, h * 0.22, d / 2 + mm(12));
  handle.castShadow = true;
  group.add(handle);

  return group;
}

/**
 * Corner cabinet: L-shaped body with doors on both visible faces,
 * L-shaped countertop, and handles.
 * The cabinet sits at a 90° wall junction. Limb A extends along the X axis
 * (back wall) and limb B extends along the Z axis (side wall).
 */
export function createCornerCabinet(
  width: number,
  depth: number,
  height: number,
  options?: {
    includeCountertop?: boolean;
  },
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'corner-cabinet';

  const w = mm(width);  // limb length along each wall
  const d = mm(depth);  // depth of each limb
  const h = mm(height);

  // L-shaped body using ExtrudeGeometry
  const shape = new THREE.Shape();
  // Start at origin (inner corner), draw L-shape clockwise
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);          // along back wall
  shape.lineTo(w, d);          // front face of back-wall limb
  shape.lineTo(d, d);          // step in to the corner block
  shape.lineTo(d, w);          // front face of side-wall limb
  shape.lineTo(0, w);          // along side wall
  shape.lineTo(0, 0);          // close

  const extrudeSettings = { depth: h, bevelEnabled: false };
  const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Rotate so extrusion goes up (Y axis)
  bodyGeo.rotateX(-Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, woodMaterial(COLORS.cabinetBody));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Door panel A — on the front face of back-wall limb (facing +Z)
  const doorMargin = mm(3);
  const doorAW = w - d - doorMargin * 2; // door width = limb length minus corner block
  const doorH = h - doorMargin * 2;
  if (doorAW > 0) {
    const doorAGeo = new THREE.BoxGeometry(doorAW, doorH, mm(3));
    const doorA = new THREE.Mesh(doorAGeo, facadeMaterial);
    doorA.position.set(d + doorAW / 2, h / 2, d + mm(1));
    doorA.castShadow = true;
    group.add(doorA);

    // Handle on door A
    const handleAW = Math.min(mm(130), doorAW * 0.4);
    const handleAGeo = new THREE.CylinderGeometry(mm(3.5), mm(3.5), handleAW, 8);
    handleAGeo.rotateZ(Math.PI / 2);
    const handleA = new THREE.Mesh(handleAGeo, metalMaterial());
    handleA.position.set(d + doorAW / 2, h * 0.72, d + mm(14));
    handleA.castShadow = true;
    group.add(handleA);
  }

  // Door panel B — on the front face of side-wall limb (facing +X)
  const doorBW = w - d - doorMargin * 2;
  if (doorBW > 0) {
    const doorBGeo = new THREE.BoxGeometry(mm(3), doorH, doorBW);
    const doorB = new THREE.Mesh(doorBGeo, facadeMaterial);
    doorB.position.set(d + mm(1), h / 2, d + doorBW / 2);
    doorB.castShadow = true;
    group.add(doorB);

    // Handle on door B
    const handleBW = Math.min(mm(130), doorBW * 0.4);
    const handleBGeo = new THREE.CylinderGeometry(mm(3.5), mm(3.5), handleBW, 8);
    // Rotate to align along Z axis
    handleBGeo.rotateX(Math.PI / 2);
    const handleB = new THREE.Mesh(handleBGeo, metalMaterial());
    handleB.position.set(d + mm(14), h * 0.72, d + doorBW / 2);
    handleB.castShadow = true;
    group.add(handleB);
  }

  // L-shaped countertop
  if (options?.includeCountertop !== false) {
    group.add(createCornerCountertop(width, depth, height));
  }

  return group;
}

/**
 * Tall cabinet: full-height body with upper and lower door panels, handles.
 * Typically 2100mm tall. No countertop.
 */
export function createTallCabinet(
  width: number,
  depth: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tall-cabinet';

  const w = mm(width);
  const d = mm(depth);
  const h = mm(height);

  // Cabinet body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(bodyGeo, woodMaterial(COLORS.cabinetBody));
  body.position.set(0, h / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const doorMargin = mm(3);
  const doorW = w - doorMargin * 2;
  const dividerY = h * 0.55; // divider at 55% height
  const dividerH = mm(4);

  // Lower door (below divider)
  const lowerDoorH = dividerY - doorMargin * 2 - dividerH / 2;
  if (lowerDoorH > 0) {
    const lowerDoorGeo = new THREE.BoxGeometry(doorW, lowerDoorH, mm(3));
    const lowerDoor = new THREE.Mesh(lowerDoorGeo, facadeMaterial);
    lowerDoor.position.set(0, lowerDoorH / 2 + doorMargin, d / 2 + mm(1));
    lowerDoor.castShadow = true;
    group.add(lowerDoor);

    // Recessed inner panel (lower)
    const innerMargin = mm(18);
    const innerGeo = new THREE.BoxGeometry(
      doorW - innerMargin * 2,
      lowerDoorH - innerMargin * 2,
      mm(1.5),
    );
    const inner = new THREE.Mesh(innerGeo, woodMaterial(COLORS.cabinetBody));
    inner.position.set(0, lowerDoorH / 2 + doorMargin, d / 2 + mm(3));
    group.add(inner);

    // Lower handle
    const handleW = Math.min(mm(160), doorW * 0.4);
    const handleGeo = new THREE.CylinderGeometry(mm(4), mm(4), handleW, 8);
    handleGeo.rotateZ(Math.PI / 2);
    const handle = new THREE.Mesh(handleGeo, metalMaterial());
    handle.position.set(0, dividerY - mm(50), d / 2 + mm(14));
    handle.castShadow = true;
    group.add(handle);
  }

  // Horizontal divider strip
  const divGeo = new THREE.BoxGeometry(w, dividerH, mm(3));
  const divider = new THREE.Mesh(divGeo, woodMaterial(COLORS.cabinetBody));
  divider.position.set(0, dividerY, d / 2 + mm(1));
  group.add(divider);

  // Upper door (above divider)
  const upperDoorH = h - dividerY - doorMargin * 2 - dividerH / 2;
  if (upperDoorH > 0) {
    const upperDoorGeo = new THREE.BoxGeometry(doorW, upperDoorH, mm(3));
    const upperDoor = new THREE.Mesh(upperDoorGeo, facadeMaterial);
    upperDoor.position.set(0, dividerY + dividerH / 2 + upperDoorH / 2 + doorMargin, d / 2 + mm(1));
    upperDoor.castShadow = true;
    group.add(upperDoor);

    // Recessed inner panel (upper)
    const innerMargin = mm(16);
    const upperInnerGeo = new THREE.BoxGeometry(
      doorW - innerMargin * 2,
      upperDoorH - innerMargin * 2,
      mm(1.5),
    );
    const upperInner = new THREE.Mesh(upperInnerGeo, woodMaterial(COLORS.cabinetBody));
    upperInner.position.set(0, dividerY + dividerH / 2 + upperDoorH / 2 + doorMargin, d / 2 + mm(3));
    group.add(upperInner);

    // Upper handle
    const handleW = Math.min(mm(130), doorW * 0.35);
    const handleGeo = new THREE.CylinderGeometry(mm(3.5), mm(3.5), handleW, 8);
    handleGeo.rotateZ(Math.PI / 2);
    const handle = new THREE.Mesh(handleGeo, metalMaterial());
    handle.position.set(0, dividerY + mm(50), d / 2 + mm(12));
    handle.castShadow = true;
    group.add(handle);
  }

  return group;
}

/**
 * Thin filler panel to fill gaps between cabinets.
 */
export function createFillerPanel(width: number, height: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(mm(width), mm(height), mm(20));
  const mesh = new THREE.Mesh(geo, woodMaterial(COLORS.filler));
  mesh.name = 'filler-panel';
  mesh.position.y = mm(height) / 2;
  mesh.castShadow = true;
  return mesh;
}

/**
 * Sink: stainless steel basin with rim and faucet, sits on countertop.
 */
export function createSink(width: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sink';

  const w = mm(width);
  const basinW = w * 0.6;
  const basinD = mm(350);
  const basinH = mm(30);
  const rimThickness = mm(4);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xD0D0D0,
    roughness: 0.25,
    metalness: 0.8,
  });

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xA8A8A8,
    roughness: 0.35,
    metalness: 0.7,
  });

  // Rim
  const rimGeo = new THREE.BoxGeometry(basinW + rimThickness * 2, rimThickness, basinD + rimThickness * 2);
  const rim = new THREE.Mesh(rimGeo, steelMat);
  rim.position.set(0, rimThickness / 2, 0);
  rim.castShadow = true;
  group.add(rim);

  // Basin bottom
  const bottomGeo = new THREE.BoxGeometry(basinW, mm(2), basinD);
  const bottom = new THREE.Mesh(bottomGeo, innerMat);
  bottom.position.set(0, -basinH, 0);
  group.add(bottom);

  // Basin walls — reuse geometries for matching pairs
  const fbGeo = new THREE.BoxGeometry(basinW, basinH, mm(2));
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(fbGeo, innerMat);
    wall.position.set(0, -basinH / 2, s * basinD / 2);
    group.add(wall);
  }
  const lrGeo = new THREE.BoxGeometry(mm(2), basinH, basinD);
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(lrGeo, innerMat);
    wall.position.set(s * basinW / 2, -basinH / 2, 0);
    group.add(wall);
  }

  // Faucet
  const faucetMat = new THREE.MeshStandardMaterial({
    color: 0xC0C0C0,
    roughness: 0.12,
    metalness: 0.95,
  });
  const pipeGeo = new THREE.CylinderGeometry(mm(10), mm(12), mm(250), 12);
  const pipe = new THREE.Mesh(pipeGeo, faucetMat);
  pipe.position.set(0, mm(125), -basinD / 2 - mm(25));
  pipe.castShadow = true;
  group.add(pipe);

  const spoutGeo = new THREE.CylinderGeometry(mm(6), mm(6), mm(100), 8);
  spoutGeo.rotateX(Math.PI / 2);
  const spout = new THREE.Mesh(spoutGeo, faucetMat);
  spout.position.set(0, mm(240), -basinD / 2 + mm(25));
  spout.castShadow = true;
  group.add(spout);
  group.rotation.y += Math.PI;
  return group;
}

/**
 * Cooktop: glass-ceramic surface with burner rings.
 */
export function createCooktop(width: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cooktop';

  const w = mm(width);
  const d = mm(500);
  const surfaceH = mm(6);

  // Glass-ceramic surface — dark grey, not pure black
  const surfaceGeo = new THREE.BoxGeometry(w * 0.85, surfaceH, d * 0.8);
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.08,
    metalness: 0.15,
  });
  const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
  surface.position.set(0, surfaceH / 2, 0);
  surface.castShadow = true;
  surface.receiveShadow = true;
  group.add(surface);

  // Burner rings
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.4,
    metalness: 0.5,
  });

  const bigR = mm(90);
  const smallR = mm(65);
  const burners = [
    { x: -w * 0.2, z: -d * 0.18, r: bigR },
    { x: w * 0.2, z: -d * 0.18, r: smallR },
    { x: -w * 0.2, z: d * 0.18, r: smallR },
    { x: w * 0.2, z: d * 0.18, r: bigR },
  ];

  for (const { x, z, r } of burners) {
    const ringGeo = new THREE.TorusGeometry(r, mm(6), 8, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, surfaceH + mm(2), z);
    group.add(ring);
  }
  group.rotation.y += Math.PI;

  return group;
}

/**
 * Plinth strip along the bottom of cabinets.
 */
export function createPlinth(width: number): THREE.Mesh {
  const h = mm(80);
  const d = mm(560);
  const geo = new THREE.BoxGeometry(mm(width), h, d);
  const mesh = new THREE.Mesh(geo, woodMaterial(COLORS.plinth));
  mesh.name = 'plinth';
  mesh.position.set(0, h / 2, 0);
  mesh.receiveShadow = true;
  return mesh;
}

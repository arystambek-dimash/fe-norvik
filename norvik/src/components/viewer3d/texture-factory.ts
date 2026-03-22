import * as THREE from 'three';

// Texture cache — avoids recreating expensive procedural canvases on every scene rebuild
const textureCache = new Map<string, THREE.CanvasTexture>();
const cachedTextureSet = new Set<THREE.Texture>();

function cached(key: string, factory: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const existing = textureCache.get(key);
  if (existing) return existing;
  const tex = factory();
  textureCache.set(key, tex);
  cachedTextureSet.add(tex);
  return tex;
}

/** Check whether a texture is held in the cache (should not be disposed during scene teardown) */
export function isTextureCached(texture: THREE.Texture): boolean {
  return cachedTextureSet.has(texture);
}

/** Dispose all cached textures and clear the cache — call on full unmount */
export function clearTextureCache(): void {
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();
  cachedTextureSet.clear();
}

/**
 * Procedural wood-plank floor texture.
 * Warm oak tones with realistic plank gaps and subtle grain.
 */
export function createFloorTexture(): THREE.CanvasTexture {
  return cached('floor', _createFloorTexture);
}

function _createFloorTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Warm oak palette
  const plankColors = [
    '#C4A882', '#B89B72', '#D1B892', '#BFA57A',
    '#CAAE88', '#C0A07B', '#D5BC96', '#B69870',
  ];

  const plankCount = 10;
  const plankH = h / plankCount;

  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH;
    const baseColor = plankColors[i % plankColors.length];

    // Fill plank base
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, y + 1, w, plankH - 2);

    // Subtle wood grain — curved parallel lines
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#4A3520';
    ctx.lineWidth = 0.8;
    for (let g = 0; g < 12; g++) {
      const gy = y + 4 + (g / 12) * (plankH - 8);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      // Gentle wave for natural grain
      const amp = 1.5 + Math.random() * 2;
      const freq = 0.003 + Math.random() * 0.002;
      for (let x = 0; x <= w; x += 4) {
        ctx.lineTo(x, gy + Math.sin(x * freq + i * 2 + g) * amp);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Highlight grain — lighter streaks
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#FFF8E8';
    ctx.lineWidth = 1.2;
    for (let g = 0; g < 4; g++) {
      const gy = y + 8 + Math.random() * (plankH - 16);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= w; x += 6) {
        ctx.lineTo(x, gy + Math.sin(x * 0.004 + g * 3) * 1.5);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Plank gap — dark line with slight shadow
    ctx.fillStyle = 'rgba(60, 40, 20, 0.35)';
    ctx.fillRect(0, y, w, 1.5);
    ctx.fillStyle = 'rgba(60, 40, 20, 0.12)';
    ctx.fillRect(0, y + 1.5, w, 1);

    // Staggered vertical joins (2 per plank, offset per row)
    const joinOffset = (i % 3) * (w / 3);
    const joins = [joinOffset + w * 0.35, joinOffset + w * 0.75];
    for (const jx of joins) {
      const nx = ((jx % w) + w) % w;
      ctx.fillStyle = 'rgba(60, 40, 20, 0.2)';
      ctx.fillRect(nx, y, 1.5, plankH);
    }
  }

  // Very subtle overall noise for organic feel
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Warm off-white plaster wall texture with subtle trowel marks.
 */
export function createWallTexture(): THREE.CanvasTexture {
  return cached('wall', _createWallTexture);
}

function _createWallTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Warm white base
  ctx.fillStyle = '#F7F3EC';
  ctx.fillRect(0, 0, size, size);

  // Layered subtle trowel marks (large soft strokes)
  ctx.save();
  ctx.globalAlpha = 0.015;
  ctx.strokeStyle = '#C8BAA8';
  ctx.lineWidth = 30;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(
      size * 0.3, y + (Math.random() - 0.5) * 60,
      size * 0.7, y + (Math.random() - 0.5) * 60,
      size + 20, y + (Math.random() - 0.5) * 40,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Fine noise for plaster grain
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * White subway tile backsplash texture with warm grey grout.
 */
export function createTileTexture(): THREE.CanvasTexture {
  return cached('tile', _createTileTexture);
}

function _createTileTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Grout color — warm grey
  ctx.fillStyle = '#C8C0B4';
  ctx.fillRect(0, 0, size, size);

  const tileW = 76;
  const tileH = 38;
  const grout = 2;

  for (let row = 0; row < Math.ceil(size / tileH) + 1; row++) {
    const offset = (row % 2 === 1) ? tileW / 2 : 0;
    for (let col = -1; col < Math.ceil(size / tileW) + 2; col++) {
      const x = col * tileW + offset;
      const y = row * tileH;

      // Tile base — slight warm-white variation
      const b = 242 + Math.floor(Math.random() * 8);
      const warmth = Math.floor(Math.random() * 3);
      ctx.fillStyle = `rgb(${b}, ${b - 1}, ${b - 2 - warmth})`;

      const tx = x + grout;
      const ty = y + grout;
      const tw = tileW - grout * 2;
      const th = tileH - grout * 2;

      // Rounded tile corners
      const r = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx + r, ty);
      ctx.lineTo(tx + tw - r, ty);
      ctx.quadraticCurveTo(tx + tw, ty, tx + tw, ty + r);
      ctx.lineTo(tx + tw, ty + th - r);
      ctx.quadraticCurveTo(tx + tw, ty + th, tx + tw - r, ty + th);
      ctx.lineTo(tx + r, ty + th);
      ctx.quadraticCurveTo(tx, ty + th, tx, ty + th - r);
      ctx.lineTo(tx, ty + r);
      ctx.quadraticCurveTo(tx, ty, tx + r, ty);
      ctx.closePath();
      ctx.fill();

      // Subtle glaze reflection at top
      ctx.save();
      ctx.globalAlpha = 0.04;
      const grad = ctx.createLinearGradient(tx, ty, tx, ty + th);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

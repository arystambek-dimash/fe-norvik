import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Shared GLTFLoader singleton — avoids creating multiple loader instances */
export const gltfLoader = new GLTFLoader();

const R2_ORIGIN = 'https://pub-0f21558eef0d42a39f2ba250b314573c.r2.dev';

/** Rewrite R2 URLs to go through the dev-server proxy */
export function proxyGlbUrl(url: string): string {
  if (url.startsWith(R2_ORIGIN)) {
    return '/r2-proxy' + url.slice(R2_ORIGIN.length);
  }
  return url;
}

/** Enable cast + receive shadows on every mesh in an object tree */
export function enableShadows(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

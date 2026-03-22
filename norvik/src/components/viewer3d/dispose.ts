import * as THREE from 'three';
import { isTextureCached } from './texture-factory';

export function disposeMaterial(m: THREE.Material): void {
  if (m instanceof THREE.MeshStandardMaterial) {
    if (m.map && !isTextureCached(m.map)) m.map.dispose();
    if (m.normalMap && !isTextureCached(m.normalMap)) m.normalMap.dispose();
    if (m.roughnessMap && !isTextureCached(m.roughnessMap)) m.roughnessMap.dispose();
    if (m.metalnessMap && !isTextureCached(m.metalnessMap)) m.metalnessMap.dispose();
    if (m.aoMap && !isTextureCached(m.aoMap)) m.aoMap.dispose();
    if (m.emissiveMap && !isTextureCached(m.emissiveMap)) m.emissiveMap.dispose();
  } else if ('map' in m && m.map instanceof THREE.Texture) {
    if (!isTextureCached(m.map)) m.map.dispose();
  }
  m.dispose();
}

/** Dispose all geometry and materials on an object tree (does not remove from parent) */
export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(child.material);
      }
    }
  });
}

export function disposeScene(scene: THREE.Scene): void {
  disposeObject(scene);
  scene.clear();
}

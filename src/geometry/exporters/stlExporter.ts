import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { Transform } from '../../core/types';

export interface StlGeometry { geometry: BufferGeometry; transform?: Transform }

export function exportStl(items: readonly (BufferGeometry | StlGeometry)[], binary = true): ArrayBuffer | string {
  const root = new Object3D();
  const material = new MeshBasicMaterial();
  for (const item of items) {
    const entry: StlGeometry = item instanceof BufferGeometry ? { geometry: item } : item;
    const mesh = new Mesh(entry.geometry, material);
    if (entry.transform) {
      mesh.position.fromArray([...entry.transform.position]);
      mesh.rotation.set(...entry.transform.rotation.map((value) => value * Math.PI / 180) as [number, number, number]);
    }
    mesh.updateMatrix();
    root.add(mesh);
  }
  root.updateMatrixWorld(true);
  const output = new STLExporter().parse(root, { binary });
  material.dispose();
  if (typeof output === 'string') return output;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { BufferGeometry, MeshBasicMaterial } from 'three';
import type { CsgEngine } from './CsgEngine';

/**
 * three-bvh-csg を直接 import してよいのはこのファイルだけ（設計書 §4.3）。
 */
export class BvhCsgEngine implements CsgEngine {
  private evaluator = new Evaluator();
  private material = new MeshBasicMaterial();

  constructor() {
    // Ver.1 は単一マテリアル。断面を別色にするのは Ver.2。
    this.evaluator.useGroups = false;
    this.evaluator.attributes = ['position', 'normal'];
  }

  async subtract(base: BufferGeometry, tool: BufferGeometry): Promise<BufferGeometry> {
    // Brush adds acceleration data to its geometry. Keep caller-owned inputs untouched.
    const a = new Brush(base.clone(), this.material);
    const b = new Brush(tool.clone(), this.material);
    const target = new Brush(new BufferGeometry(), this.material);
    a.updateMatrixWorld(true);
    b.updateMatrixWorld(true);

    try {
      this.evaluator.evaluate(a, b, SUBTRACTION, target);
      const geometry = target.geometry.clone();
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return geometry;
    } finally {
      a.disposeCacheData();
      b.disposeCacheData();
      a.geometry.dispose();
      b.geometry.dispose();
      target.geometry.dispose();
    }
  }

  dispose(): void {
    this.evaluator = new Evaluator();
    this.evaluator.useGroups = false;
    this.evaluator.attributes = ['position', 'normal'];
    this.material.dispose();
  }
}

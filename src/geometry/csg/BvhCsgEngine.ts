import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import type { BufferGeometry } from 'three';
import type { CsgEngine } from './CsgEngine';

/**
 * three-bvh-csg を直接 import してよいのはこのファイルだけ（設計書 §4.3）。
 */
export class BvhCsgEngine implements CsgEngine {
  private evaluator = new Evaluator();

  constructor() {
    // Ver.1 は単一マテリアル。断面を別色にするのは Ver.2。
    this.evaluator.useGroups = false;
    this.evaluator.attributes = ['position', 'normal'];
  }

  async subtract(base: BufferGeometry, tool: BufferGeometry): Promise<BufferGeometry> {
    const a = new Brush(base);
    const b = new Brush(tool);
    a.updateMatrixWorld(true);
    b.updateMatrixWorld(true);

    const result = this.evaluator.evaluate(a, b, SUBTRACTION);
    // evaluate はターゲットのバッファを使い回すので、必ず clone して切り離す
    const geometry = result.geometry.clone();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  dispose(): void {
    this.evaluator = new Evaluator();
  }
}

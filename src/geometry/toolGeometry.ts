import { BoxGeometry, CylinderGeometry, Euler, Matrix4, type BufferGeometry } from 'three';
import { CYLINDER_SEGMENTS } from '../core/constants';
import { degToRad } from '../core/math/angle';
import type { ToolSolidSpec } from '../core/types';

/**
 * ToolSolidSpec から、位置と姿勢を焼き込んだジオメトリを作る。
 * プレビューと CSG の両方がこの 1 本を使うので、見た目と結果が必ず一致する。
 */
export function createToolGeometry(spec: ToolSolidSpec): BufferGeometry {
  const geometry: BufferGeometry =
    spec.shape === 'cylinder'
      ? new CylinderGeometry(spec.size.x / 2, spec.size.x / 2, spec.size.y, CYLINDER_SEGMENTS)
      : new BoxGeometry(spec.size.x, spec.size.y, spec.size.z);
  geometry.deleteAttribute('uv');

  const euler = new Euler(
    degToRad(spec.rotation[0]),
    degToRad(spec.rotation[1]),
    degToRad(spec.rotation[2]),
    'XYZ',
  );
  const matrix = new Matrix4().makeRotationFromEuler(euler);
  matrix.setPosition(spec.position[0], spec.position[1], spec.position[2]);
  geometry.applyMatrix4(matrix);
  return geometry;
}

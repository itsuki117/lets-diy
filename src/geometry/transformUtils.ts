import type { Object3D } from 'three';
import { degToRad, radToDeg } from '../core/math/angle';
import { normalizeDeg } from '../core/math/angle';
import type { Transform, Vec3 } from '../core/types';

/** 設計データの Transform（度）を Object3D に適用する。度とラジアンの変換はここに閉じ込める。 */
export function applyTransform(object: Object3D, transform: Transform): void {
  object.position.set(transform.position[0], transform.position[1], transform.position[2]);
  object.rotation.set(
    degToRad(transform.rotation[0]),
    degToRad(transform.rotation[1]),
    degToRad(transform.rotation[2]),
    'XYZ',
  );
  object.updateMatrixWorld();
}

/** Object3D から設計データの Transform を読み出す */
export function readTransform(object: Object3D): Transform {
  const position: Vec3 = [object.position.x, object.position.y, object.position.z];
  const rotation: Vec3 = [
    normalizeDeg(radToDeg(object.rotation.x)),
    normalizeDeg(radToDeg(object.rotation.y)),
    normalizeDeg(radToDeg(object.rotation.z)),
  ];
  return { position, rotation };
}

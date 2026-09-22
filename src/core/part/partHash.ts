import type { Operation, Part } from '../types';

/**
 * 形状に影響する値だけを固定順の配列にする。
 * JSON.stringify のキー順ゆらぎを避けるため、必ず配列へ落とすこと。
 */
function normalizeOperationForHash(op: Operation): unknown[] {
  switch (op.type) {
    case 'roundHole':
      return ['roundHole', op.diameter, op.depth, op.through, ...op.position, op.direction];
    case 'rectHole':
      return ['rectHole', op.width, op.height, op.depth, op.through, ...op.position, op.direction, op.rotation];
    case 'arch':
      return ['arch', op.width, op.height, op.rise, op.depth, op.through, ...op.position, op.direction, op.rotation];
    case 'roundCorner':
      return ['roundCorner', op.radius, op.direction, [...op.corners].sort().join(',')];
    case 'notch':
      return ['notch', op.size.x, op.size.y, op.size.z, ...op.position];
    case 'cut':
      return ['cut', op.axis, op.offset, op.keep];
  }
}

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * 形状ハッシュ。transform / name / visible / locked は形状に影響しないので含めない。
 * これにより移動・回転では CSG が走らない（設計書 §17.3）。
 */
export function hashPartShape(part: Part): string {
  const shape = [
    part.size.x,
    part.size.y,
    part.size.z,
    part.operations.filter((op) => op.enabled).map(normalizeOperationForHash),
  ];
  return fnv1a(JSON.stringify(shape));
}

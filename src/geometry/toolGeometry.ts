import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Matrix4,
  Path,
  Shape,
  type BufferGeometry,
} from 'three';
import { CYLINDER_SEGMENTS, OVERCUT } from '../core/constants';
import { degToRad } from '../core/math/angle';
import type { CornerKey, Size3, ToolSolidSpec } from '../core/types';

/**
 * アーチ断面（矩形の上辺を弧にしたもの）を +Z 方向へ押し出した立体。
 * ツール自身の座標系で作り、中心原点に揃える。部材ローカルへの向き合わせは呼び出し側の行列が行う。
 *
 * rise は弧の高さ。0 なら矩形、width / 2 なら半円、それ以外は楕円弧になる。
 */
function createArchGeometry(size: Size3, rise: number): BufferGeometry {
  const halfWidth = size.x / 2;
  const halfHeight = size.y / 2;
  const arc = Math.min(Math.max(rise, 0), size.y);
  // 弧の中心の高さ。ここから上が曲線、下が直線になる。
  const arcCenterY = halfHeight - arc;

  const shape = new Shape();
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(-halfWidth, arcCenterY);
  if (arc > 1e-6 && halfWidth > 1e-6) {
    // 角度 PI -> 0 を時計回りにたどると、頂点 (0, halfHeight) を通る上側の弧になる
    shape.absellipse(0, arcCenterY, halfWidth, arc, Math.PI, 0, true, 0);
  } else {
    shape.lineTo(halfWidth, arcCenterY);
  }
  shape.lineTo(halfWidth, -halfHeight);
  shape.closePath();

  return extrudeCentered(shape, size.z);
}

/**
 * 角丸用の「枠」立体。
 *
 * 素材の外形より少し大きい矩形から、角を丸めた外形をくり抜いた額縁状の断面を押し出す。
 * 丸めない角は枠の幅が 0 になるので、その角は削られない。
 * 四隅を 1 つの立体で扱えるため、CSG に渡す形が単純になる。
 */
function createCornerFrameGeometry(size: Size3, radius: number, keys: readonly CornerKey[]): BufferGeometry {
  const halfU = size.x / 2;
  const halfV = size.y / 2;
  const margin = OVERCUT * 2;
  const limit = Math.min(halfU, halfV);
  const r = Math.min(Math.max(radius, 0), limit);
  const at = (key: CornerKey): number => (keys.includes(key) ? r : 0);

  // 外枠: 素材より少し大きい矩形
  const outer = new Shape();
  outer.moveTo(-halfU - margin, -halfV - margin);
  outer.lineTo(halfU + margin, -halfV - margin);
  outer.lineTo(halfU + margin, halfV + margin);
  outer.lineTo(-halfU - margin, halfV + margin);
  outer.closePath();

  // 内側: 残したい角丸矩形。反時計回りにたどる
  const bl = at('bottomLeft');
  const br = at('bottomRight');
  const tr = at('topRight');
  const tl = at('topLeft');
  const inner = new Path();
  inner.moveTo(-halfU + bl, -halfV);
  inner.lineTo(halfU - br, -halfV);
  if (br > 0) inner.absarc(halfU - br, -halfV + br, br, -Math.PI / 2, 0, false);
  inner.lineTo(halfU, halfV - tr);
  if (tr > 0) inner.absarc(halfU - tr, halfV - tr, tr, 0, Math.PI / 2, false);
  inner.lineTo(-halfU + tl, halfV);
  if (tl > 0) inner.absarc(-halfU + tl, halfV - tl, tl, Math.PI / 2, Math.PI, false);
  inner.lineTo(-halfU, -halfV + bl);
  if (bl > 0) inner.absarc(-halfU + bl, -halfV + bl, bl, Math.PI, Math.PI * 1.5, false);
  inner.closePath();
  outer.holes.push(inner);

  return extrudeCentered(outer, size.z);
}

/** 断面を +Z へ押し出し、中心原点へ寄せる */
function extrudeCentered(shape: Shape, depth: number): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: CYLINDER_SEGMENTS,
  });
  // ExtrudeGeometry は z = 0..depth に作られるので、中心原点へ寄せる
  geometry.translate(0, 0, -depth / 2);
  geometry.deleteAttribute('uv');
  return geometry;
}

/**
 * ToolSolidSpec から、位置と姿勢を焼き込んだジオメトリを作る。
 * プレビューと CSG の両方がこの 1 本を使うので、見た目と結果が必ず一致する。
 */
export function createToolGeometry(spec: ToolSolidSpec): BufferGeometry {
  let geometry: BufferGeometry;
  switch (spec.shape) {
    case 'cylinder':
      geometry = new CylinderGeometry(spec.size.x / 2, spec.size.x / 2, spec.size.y, CYLINDER_SEGMENTS);
      geometry.deleteAttribute('uv');
      break;
    case 'arch':
      geometry = createArchGeometry(spec.size, spec.rise ?? 0);
      break;
    case 'cornerFrame':
      geometry = createCornerFrameGeometry(spec.size, spec.corner?.radius ?? 0, spec.corner?.keys ?? []);
      break;
    default:
      geometry = new BoxGeometry(spec.size.x, spec.size.y, spec.size.z);
      geometry.deleteAttribute('uv');
      break;
  }

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

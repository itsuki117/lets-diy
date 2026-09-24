import { applyMat3, matrixFromColumns, matrixToEuler, rotationMatrix, transpose, type Mat3 } from '../math/matrix';
import { applyRigid, composeRigid, invertRigid, rigidFromTransform, type Rigid } from '../math/rigid';
import { add, cross, dot, length, normalize, scale, sub } from '../math/vec3';
import type {
  GasSpringMount,
  GasSpringSpec,
  Hardware,
  HardwarePreset,
  Joint,
  MovableJoint,
  Part,
  PartId,
  PrismaticJoint,
  Project,
  RevoluteJoint,
  Vec3,
  AxisDirection,
} from '../types';

/**
 * 金物が「どう動くか」を決める純粋関数（設計書 DESIGN_V2 §8, §10.4）。
 *
 * 動きの向き・範囲はユーザーが手で設定するものではなく、取り付けた金物の
 * 向きと仕様から決まる。丁番はピンのまわりにしか回らず、レールはレールの
 * 長さ方向にストロークぶんしか出ず、ガススプリングは縮みきり〜伸びきりの
 * 長さの外へは動けない。
 */

const WORLD_UP: Vec3 = [0, 1, 0];

// ------------------------------------------------------------
// 共通の幾何
// ------------------------------------------------------------

const half = (part: Part): Vec3 => [part.size.x / 2, part.size.y / 2, part.size.z / 2];

/** moving ローカル から base ローカル（rest pose） */
export const restOffset = (base: Part, moving: Part): Rigid =>
  composeRigid(invertRigid(rigidFromTransform(base.transform)), rigidFromTransform(moving.transform));

const column = (m: Mat3, i: 0 | 1 | 2): Vec3 => [m[i], m[i + 3]!, m[i + 6]!];

/** 中心原点・軸平行の箱と点の距離（内側なら 0） */
function pointBoxDistance(point: Vec3, h: Vec3): number {
  const d = [0, 1, 2].map((i) => Math.max(Math.abs(point[i]!) - h[i]!, 0));
  return Math.hypot(d[0]!, d[1]!, d[2]!);
}

/** 部材ローカルでの点から、部材の表面までの距離（内側でも表面までの距離） */
function surfaceDistance(point: Vec3, h: Vec3): number {
  const outside = pointBoxDistance(point, h);
  if (outside > 0) return outside;
  return Math.min(...[0, 1, 2].map((i) => h[i]! - Math.abs(point[i]!)));
}

/** base ローカルでの moving の軸平行外接箱 */
function movingBounds(offset: Rigid, moving: Part): { min: Vec3; max: Vec3 } {
  const h = half(moving);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = applyRigid(offset, [sx * h[0], sy * h[1], sz * h[2]]);
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i]!, p[i]!);
      max[i] = Math.max(max[i]!, p[i]!);
    }
  }
  return { min, max };
}

/** 3 本の列ベクトルの基底 から 金物の Euler 回転（度） */
const eulerFromFrame = (x: Vec3, y: Vec3, z: Vec3): Vec3 => matrixToEuler(matrixFromColumns(x, y, z));

/**
 * 部材の箱で「相手の中心の方を向いている面」。
 * 金物の穴はこの面から掘る（側板なら内側の面、扉なら裏面）。
 */
function faceToward(h: Vec3, target: Vec3): { axis: 0 | 1 | 2; sign: 1 | -1 } {
  let best: { axis: 0 | 1 | 2; sign: 1 | -1 } = { axis: 2, sign: 1 };
  let bestRatio = -Infinity;
  for (const axis of [0, 1, 2] as const) {
    const ratio = Math.abs(target[axis]) / Math.max(h[axis], 1e-6);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = { axis, sign: target[axis] >= 0 ? 1 : -1 };
    }
  }
  return best;
}

/** 金物を付ける面（部材ローカルの外向き法線の向き） */
export interface MountFaces {
  base: AxisDirection;
  moving: AxisDirection;
}

const faceAxis = (face: AxisDirection): { axis: 0 | 1 | 2; sign: 1 | -1 } =>
  ({ axis: face[1] === 'x' ? 0 : face[1] === 'y' ? 1 : 2, sign: face[0] === '+' ? 1 : -1 });

export const faceVector = (face: AxisDirection): Vec3 => {
  const { axis, sign } = faceAxis(face);
  return axis === 0 ? [sign, 0, 0] : axis === 1 ? [0, sign, 0] : [0, 0, sign];
};

/** 選んだ 2 面の外向き法線（どちらも base ローカル） */
export function faceNormals(base: Part, moving: Part, faces: MountFaces): { base: Vec3; moving: Vec3 } {
  return { base: faceVector(faces.base), moving: applyMat3(restOffset(base, moving).rotation, faceVector(faces.moving)) };
}

/** 金物が付いている 2 部材。古いデータは joint から引く */
export function hardwarePartIds(project: Project, hardware: Hardware): { base: PartId; moving: PartId } | null {
  if (hardware.parts) return hardware.parts;
  const joint = project.joints.find((item) => item.id === hardware.jointId);
  return joint ? { base: joint.basePartId, moving: joint.movingPartId } : null;
}

/** その部材を（直接・間接に）joint で動かしている部材の集合 */
export function movingSubtree(project: Project, rootId: PartId): Set<PartId> {
  const result = new Set<PartId>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const joint of project.joints) {
      if (joint.enabled && result.has(joint.basePartId) && !result.has(joint.movingPartId)) {
        result.add(joint.movingPartId);
        grew = true;
      }
    }
  }
  return result;
}

// ------------------------------------------------------------
// 丁番: ピンの位置と向きを部材の配置から決める
// ------------------------------------------------------------

export interface HingeLayout {
  /** ピンの中点（base ローカル） */
  origin: Vec3;
  /** 開く向きが正になる回転軸（base ローカル） */
  axis: Vec3;
  /** 金物の姿勢（度、base ローカル）。+Y = ピン、+X = 扉の内側、+Z = 扉の表 */
  rotation: Vec3;
  /** ピン方向の扉の長さ mm（丁番を何か所に付けるかに使う） */
  edgeLength: number;
}

/**
 * 扉（moving）のうち、固定側（base）にいちばん近い縁をピンにする。
 * ピンは扉の裏面側の角に置き、扉が固定側から離れる向きに開くよう軸の符号を決める。
 */
export function hingeLayout(base: Part, moving: Part, faces?: MountFaces): HingeLayout {
  const offset = restOffset(base, moving);
  const r = offset.rotation;
  const c = offset.translation;
  const h = half(moving);
  const sizes = [h[0], h[1], h[2]];
  const thin = sizes.indexOf(Math.min(...sizes)) as 0 | 1 | 2;
  const inPlane = ([0, 1, 2] as const).filter((i) => i !== thin);
  const thinDir = column(r, thin);
  // 裏面の向き = 固定側の中心がある側
  // 選んだ動く側の面が扉の表・裏の面なら、それを裏（固定側に向く面）とする
  const pickedBack = faces ? faceNormals(base, moving, faces).moving : null;
  const back = pickedBack && Math.abs(dot(pickedBack, thinDir)) > 0.9
    ? pickedBack
    : scale(thinDir, dot(thinDir, sub([0, 0, 0], c)) >= 0 ? 1 : -1);
  const baseHalf = half(base);

  let best: { origin: Vec3; along: Vec3; into: Vec3; edgeLength: number; distance: number } | null = null;
  for (const i of inPlane) {
    const j = inPlane.find((k) => k !== i)!;
    for (const sign of [-1, 1]) {
      const toEdge = scale(column(r, i), sign * h[i]!);
      const origin = add(add(c, toEdge), scale(back, h[thin]!));
      const distance = pointBoxDistance(origin, baseHalf);
      if (!best || distance < best.distance - 1e-6) {
        best = { origin, along: column(r, j), into: normalize(scale(toEdge, -1)), edgeLength: h[j]! * 2, distance };
      }
    }
  }
  const layout = best!;
  // 扉の中心の初速が「裏面と反対（手前）」を向く符号を正とする
  const velocity = cross(layout.along, sub(c, layout.origin));
  const axis = dot(velocity, back) > 0 ? scale(layout.along, -1) : layout.along;
  const front = scale(back, -1);
  const pin = cross(front, layout.into);
  return {
    origin: layout.origin,
    axis: normalize(axis),
    rotation: eulerFromFrame(layout.into, pin, front),
    edgeLength: layout.edgeLength,
  };
}

// ------------------------------------------------------------
// スライドレール: 引き出す向きを部材の配置から決める
// ------------------------------------------------------------

export interface RailLayout {
  /** レール中心（base ローカル、閉じた状態） */
  position: Vec3;
  /** 引き出す向き（base ローカル単位ベクトル） */
  axis: Vec3;
  rotation: Vec3;
  /** 左右 1 対で付けるときの、もう 1 本までの距離（取付面の法線方向 mm） */
  pairSpan: number;
}

/**
 * 引き出しは「前板が固定側の前端とそろう向き」に出る。
 * 固定側と引き出しが重ならない軸（= 取付面の法線）と鉛直方向は候補から外す。
 */
export function railLayout(base: Part, moving: Part, preset: HardwarePreset, faces?: MountFaces): RailLayout {
  const offset = restOffset(base, moving);
  const bounds = movingBounds(offset, moving);
  const bh = half(base);
  const baseRot = rotationMatrix(base.transform.rotation);
  const upLocal = applyMat3(transpose(baseRot), WORLD_UP);

  // 取付面の法線: 固定側と引き出しの区間が重ならない軸
  const overlaps = [0, 1, 2].map((i) => Math.min(bh[i]!, bounds.max[i]!) - Math.max(-bh[i]!, bounds.min[i]!));
  const center = offset.translation;
  let normalAxis = overlaps.indexOf(Math.min(...overlaps)) as 0 | 1 | 2;
  if (overlaps[normalAxis]! > 0) {
    const sizes = [bh[0], bh[1], bh[2]];
    normalAxis = sizes.indexOf(Math.min(...sizes)) as 0 | 1 | 2;
  }
  let normalSign: 1 | -1 = center[normalAxis]! >= 0 ? 1 : -1;
  // 面を選んでいれば、その面が取付面
  if (faces) ({ axis: normalAxis, sign: normalSign } = faceAxis(faces.base));
  const normal: Vec3 = normalAxis === 0 ? [1, 0, 0] : normalAxis === 1 ? [0, 1, 0] : [0, 0, 1];
  const outward = scale(normal, normalSign);

  let pull: Vec3 = [1, 0, 0];
  let bestGap = Infinity;
  for (const i of [0, 1, 2] as const) {
    if (i === normalAxis) continue;
    const unit: Vec3 = i === 0 ? [1, 0, 0] : i === 1 ? [0, 1, 0] : [0, 0, 1];
    if (Math.abs(dot(unit, upLocal)) > 0.7) continue;
    for (const sign of [1, -1]) {
      const movingFront = sign > 0 ? bounds.max[i]! : -bounds.min[i]!;
      const gap = Math.abs(bh[i]! - movingFront);
      if (gap < bestGap) {
        bestGap = gap;
        pull = scale(unit, sign);
      }
    }
  }

  const railLength = preset.railLength ?? preset.defaultRange?.max ?? 350;
  const pullIndex = pull.findIndex((v) => Math.abs(v) > 0.5) as 0 | 1 | 2;
  const pullSign = pull[pullIndex]! > 0 ? 1 : -1;
  const movingFront = pullSign > 0 ? bounds.max[pullIndex]! : -bounds.min[pullIndex]!;
  const front = Math.min(bh[pullIndex]!, movingFront);
  const sideIndex = ([0, 1, 2] as const).find((i) => i !== pullIndex && i !== normalAxis)!;
  const sideLow = Math.max(-bh[sideIndex]!, bounds.min[sideIndex]!);
  const sideHigh = Math.min(bh[sideIndex]!, bounds.max[sideIndex]!);

  const position: [number, number, number] = [0, 0, 0];
  position[normalAxis] = normalSign * bh[normalAxis]!;
  position[pullIndex] = pullSign * (front - railLength / 2);
  position[sideIndex] = sideHigh > sideLow ? (sideLow + sideHigh) / 2 : center[sideIndex]!;

  const up = cross(outward, pull);
  const pairSpan = bounds.max[normalAxis]! - bounds.min[normalAxis]!;
  return { position, axis: pull, rotation: eulerFromFrame(pull, up, outward), pairSpan };
}

// ------------------------------------------------------------
// 金物 から joint
// ------------------------------------------------------------

/** 金物の取付位置・姿勢から、その金物が許す動きを作り直す */
export function jointFromHardware(hardware: Hardware, joint: Joint): Joint {
  const frame = rotationMatrix(hardware.rotation);
  const localAxis = hardware.preset.motionAxis ?? (hardware.preset.kind === 'slideRail' ? [1, 0, 0] : [0, 1, 0]);
  const range = hardware.preset.defaultRange;
  if (joint.kind === 'revolute' && hardware.preset.kind === 'hinge') {
    const pin = normalize(applyMat3(frame, localAxis));
    // 開く向きの符号は既存の joint を引き継ぐ
    const axis = dot(pin, joint.axis) < 0 ? scale(pin, -1) : pin;
    return { ...joint, origin: hardware.position, axis, range: range ? { ...range } : joint.range };
  }
  if (joint.kind === 'prismatic' && (hardware.preset.kind === 'slideRail' || hardware.preset.kind === 'linearGuide')) {
    // リニアガイドを面の上に置いたときは、ブロックがレールの途中にいる。今の位置を 0 に、下と上へ動ける量を範囲にする
    const offset = hardware.travelOffset ?? 0;
    const moved = range ? { min: range.min - offset, max: range.max - offset } : joint.range;
    return { ...joint, axis: normalize(applyMat3(frame, localAxis)), range: moved };
  }
  return joint;
}

// ------------------------------------------------------------
// 何か所に付くか（丁番 2 個、レール左右 1 対、ガス左右 1 対）
// ------------------------------------------------------------

export interface HardwareInstance {
  /** 金物ローカル原点の base ローカル位置 */
  position: Vec3;
  rotation: Vec3;
}

/** 丁番をピン方向に並べる位置（金物ローカル Y の値）。端から 100mm 前後に置く */
export function hingeInstanceOffsets(quantity: number, edgeLength: number): number[] {
  if (quantity <= 1) return [0];
  const inset = Math.min(100, edgeLength / 4);
  const span = Math.max(edgeLength / 2 - inset, 0);
  return Array.from({ length: quantity }, (_, i) => -span + (2 * span * i) / (quantity - 1));
}

export function hardwareInstances(hardware: Hardware, base: Part, moving: Part): HardwareInstance[] {
  const frame = rotationMatrix(hardware.rotation);
  if (hardware.preset.kind === 'hinge') {
    const pin = column(frame, 1);
    const offset = restOffset(base, moving);
    const h = half(moving);
    const edge = [0, 1, 2].reduce((sum, i) => sum + Math.abs(dot(pin, column(offset.rotation, i as 0 | 1 | 2))) * h[i]! * 2, 0);
    return hingeInstanceOffsets(hardware.quantity, edge).map((y) => ({
      position: add(hardware.position, scale(pin, y)),
      rotation: hardware.rotation,
    }));
  }
  if (hardware.preset.kind === 'slideRail' && hardware.quantity >= 2) {
    // 左右 1 対: 引き出しの中心面で鏡写しにした位置に、向かい合わせで付ける
    const offset = restOffset(base, moving);
    const normal = column(frame, 2);
    const distance = dot(sub(offset.translation, hardware.position), normal) * 2;
    const mirrored = add(hardware.position, scale(normal, distance));
    const flipped = eulerFromFrame(column(frame, 0), scale(column(frame, 1), -1), scale(normal, -1));
    return [{ position: hardware.position, rotation: hardware.rotation }, { position: mirrored, rotation: flipped }];
  }
  if ((hardware.preset.kind === 'linearGuide' || hardware.preset.kind === 'bracket') && hardware.quantity >= 2) {
    // リニアガイドは横方向（Y）、固定金具は角に沿う方向（Z）に並べる
    const spread = column(frame, hardware.preset.kind === 'linearGuide' ? 1 : 2);
    const offset = restOffset(base, moving);
    const h = half(moving);
    const extent = [0, 1, 2].reduce((sum, i) => sum + Math.abs(dot(spread, column(offset.rotation, i as 0 | 1 | 2))) * h[i]! * 2, 0);
    return hingeInstanceOffsets(hardware.quantity, extent).map((d) => ({
      position: add(hardware.position, scale(spread, d)),
      rotation: hardware.rotation,
    }));
  }
  return [{ position: hardware.position, rotation: hardware.rotation }];
}

// ------------------------------------------------------------
// リニアガイド: 取付面に沿って、上下（なければ長い方向）に動く
// ------------------------------------------------------------

const unitAxis = (i: number, k: number): Vec3 => (i === 0 ? [k, 0, 0] : i === 1 ? [0, k, 0] : [0, 0, k]);

/**
 * レールは固定側の面に、ブロックは動く側に付く。
 * 動く向きは取付面に沿う方向のうち鉛直に近い方（上が正）。鉛直な方向が無ければ固定側の長い方向。
 * 可動量 0 のとき、ブロックはレールの下端にある（ブロック中心 = 動く側の中心の高さ）。
 */
export function linearLayout(base: Part, moving: Part, preset: HardwarePreset, faces?: MountFaces): RailLayout {
  const offset = restOffset(base, moving);
  const bounds = movingBounds(offset, moving);
  const bh = half(base);
  const upLocal = applyMat3(transpose(rotationMatrix(base.transform.rotation)), WORLD_UP);
  const center = offset.translation;
  const overlaps = [0, 1, 2].map((i) => Math.min(bh[i]!, bounds.max[i]!) - Math.max(-bh[i]!, bounds.min[i]!));
  let normalAxis = overlaps.indexOf(Math.min(...overlaps)) as 0 | 1 | 2;
  if (overlaps[normalAxis]! > 0) {
    const sizes = [bh[0], bh[1], bh[2]];
    normalAxis = sizes.indexOf(Math.min(...sizes)) as 0 | 1 | 2;
  }
  let normalSign: 1 | -1 = center[normalAxis]! >= 0 ? 1 : -1;
  if (faces) ({ axis: normalAxis, sign: normalSign } = faceAxis(faces.base));
  const others = ([0, 1, 2] as const).filter((i) => i !== normalAxis);
  let motionAxis = others.reduce((best, i) => (Math.abs(upLocal[i]!) > Math.abs(upLocal[best]!) ? i : best));
  const vertical = Math.abs(upLocal[motionAxis]!) >= 0.7;
  if (!vertical) motionAxis = others.reduce((best, i) => (bh[i]! > bh[best]! ? i : best));
  const sign = vertical ? (upLocal[motionAxis]! >= 0 ? 1 : -1) : 1;
  const lateralAxis = others.find((i) => i !== motionAxis)!;

  const railLength = preset.railLength ?? 500;
  const block = preset.blockLength ?? 60;
  const blockCenter = sign * center[motionAxis]!;
  const position: [number, number, number] = [0, 0, 0];
  position[normalAxis] = normalSign * bh[normalAxis]!;
  position[motionAxis] = sign * (blockCenter - block / 2 + railLength / 2);
  // レールは固定側の面の中に収める（細い柱なら柱の幅の中）
  position[lateralAxis] = Math.min(Math.max(center[lateralAxis]!, -bh[lateralAxis]!), bh[lateralAxis]!);

  const dir = unitAxis(motionAxis, sign);
  const outward = unitAxis(normalAxis, normalSign);
  const pairSpan = bounds.max[lateralAxis]! - bounds.min[lateralAxis]!;
  return { position, axis: dir, rotation: eulerFromFrame(dir, cross(outward, dir), outward), pairSpan };
}

// ------------------------------------------------------------
// 固定金具: 2 部材の内側の角に L 字で付ける
// ------------------------------------------------------------

export interface BracketLayout {
  position: Vec3;
  rotation: Vec3;
}

/**
 * 2 部材が接している面（接触面）と、それに直交する面でできる内側の角を探す。
 *   案 1: 固定側の接触面のうち取り付ける側からはみ出た部分と、取り付ける側の側面
 *   案 2: 取り付ける側の接触面のうち固定側からはみ出た部分と、固定側の側面
 * はみ出しが大きい方を選ぶ。金物ローカル +X が固定側に沿う脚、+Y が取り付ける側に沿う脚。
 */
export function bracketLayout(base: Part, moving: Part, faces?: MountFaces): BracketLayout {
  if (faces) return bracketLayoutFromFaces(base, moving, faces);
  const offset = restOffset(base, moving);
  const bounds = movingBounds(offset, moving);
  const bh = half(base);
  const center = offset.translation;
  const gaps = [0, 1, 2].map((i) => Math.max(bounds.min[i]! - bh[i]!, -bh[i]! - bounds.max[i]!));
  const s = gaps.indexOf(Math.max(...gaps));
  const sigma = center[s]! >= 0 ? 1 : -1;

  let best: { room: number; corner: Vec3; x: Vec3; y: Vec3 } | null = null;
  for (const i of [0, 1, 2]) {
    if (i === s) continue;
    const k = 3 - s - i;
    const alongCenter = (Math.max(-bh[k]!, bounds.min[k]!) + Math.min(bh[k]!, bounds.max[k]!)) / 2;
    for (const tau of [1, -1]) {
      const room1 = tau > 0 ? bh[i]! - bounds.max[i]! : bounds.min[i]! + bh[i]!;
      const corner1: [number, number, number] = [0, 0, 0];
      corner1[s] = sigma * bh[s]!;
      corner1[i] = tau > 0 ? bounds.max[i]! : bounds.min[i]!;
      corner1[k] = alongCenter;
      if (!best || room1 > best.room) best = { room: room1, corner: corner1, x: unitAxis(i, tau), y: unitAxis(s, sigma) };
      const room2 = tau > 0 ? bounds.max[i]! - bh[i]! : -bh[i]! - bounds.min[i]!;
      const corner2: [number, number, number] = [0, 0, 0];
      corner2[s] = sigma * bh[s]!;
      corner2[i] = tau * bh[i]!;
      corner2[k] = alongCenter;
      if (room2 > best.room) best = { room: room2, corner: corner2, x: unitAxis(s, -sigma), y: unitAxis(i, tau) };
    }
  }
  const chosen = best!;
  return { position: chosen.corner, rotation: eulerFromFrame(chosen.x, chosen.y, cross(chosen.x, chosen.y)) };
}

/**
 * 選んだ 2 面の角に付ける。+X の脚は固定側の面の上を、動く側の面の外向き（角の内側）へ。
 * +Y の脚は動く側の面の上を、固定側の面の外向きへ。2 面は直角でなければならない。
 */
function bracketLayoutFromFaces(base: Part, moving: Part, faces: MountFaces): BracketLayout {
  const normals = faceNormals(base, moving, faces);
  const offset = restOffset(base, moving);
  const bh = half(base);
  const { axis, sign } = faceAxis(faces.base);
  const movingFaceCenter = applyRigid(offset, scale(faceVector(faces.moving), Math.abs(dot(faceVector(faces.moving), half(moving)))));
  // 角の位置: 動く側の面の中心を、固定側の面の上へ
  const corner: [number, number, number] = [movingFaceCenter[0], movingFaceCenter[1], movingFaceCenter[2]];
  corner[axis] = sign * bh[axis]!;
  // 角に沿う方向は、固定側の外形の中に収める
  const along = normalize(cross(normals.moving, normals.base));
  const k = [0, 1, 2].reduce((best, i) => (Math.abs(along[i]!) > Math.abs(along[best]!) ? i : best), 0);
  corner[k] = Math.min(Math.max(corner[k]!, -bh[k]!), bh[k]!);
  return { position: corner, rotation: eulerFromFrame(normals.moving, normals.base, cross(normals.moving, normals.base)) };
}

// ------------------------------------------------------------
// ドアロック: 可動範囲の端で、受け金具（固定側）とストライカー（動く側）が噛み合う
// ------------------------------------------------------------

/**
 * ストライカーの位置（base ローカル、可動量 0 のとき）。
 * 直進は動く向きの先端、回転は回転軸からいちばん遠い縁。どちらも固定側を向いた面の上。
 */
export function strikerRestPoint(base: Part, moving: Part, joint: MovableJoint, at: 'min' | 'max'): Vec3 {
  const offset = restOffset(base, moving);
  const bounds = movingBounds(offset, moving);
  const center = offset.translation;
  const axis = normalize(joint.axis);
  const extentAlong = (dir: Vec3): number => [0, 1, 2].reduce((sum, i) => sum + Math.abs(dir[i]!) * (bounds.max[i]! - bounds.min[i]!) / 2, 0);
  if (joint.kind === 'prismatic') {
    const dir = at === 'max' ? axis : scale(axis, -1);
    const toBase = sub([0, 0, 0], center);
    const lateral = normalize(sub(toBase, scale(axis, dot(toBase, axis))));
    return add(add(center, scale(dir, extentAlong(dir))), scale(lateral, extentAlong(lateral)));
  }
  const toCenter = sub(center, joint.origin);
  const perp = sub(toCenter, scale(axis, dot(axis, toCenter)));
  const back = scale(normalize(cross(axis, perp)), -1);
  return add(add(center, perp), scale(back, Math.min(...half(moving))));
}

/** 噛み合う位置での金物の姿勢。+X = ロック位置へ向かう動きの向き */
export function latchFrame(joint: MovableJoint, strikerRest: Vec3, lockValue: number, at: 'min' | 'max'): { position: Vec3; rotation: Vec3 } {
  const position = movingAnchorAt(joint, strikerRest, lockValue);
  const axis = normalize(joint.axis);
  const motion = joint.kind === 'prismatic' ? axis : normalize(cross(axis, sub(position, joint.origin)));
  const x = scale(motion, at === 'max' ? 1 : -1);
  const helper: Vec3 = Math.abs(x[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const z = normalize(cross(x, helper));
  return { position, rotation: eulerFromFrame(x, cross(z, x), z) };
}

// ------------------------------------------------------------
// ガススプリング
// ------------------------------------------------------------

export interface GasAnchorPair {
  /** 固定側の取付点（base ローカル） */
  base: Vec3;
  /** 可動側の取付点（moving ローカル） */
  moving: Vec3;
}

/**
 * 取付点の組。数量 2 なら、扉の中心面（ピン方向）で鏡写しにしたもう 1 本を足す。
 * 左右対称なので長さの変化は同じで、力は本数倍になる。
 */
export function gasAnchorPairs(mount: GasSpringMount, quantity: number, joint: MovableJoint, base: Part, moving: Part): GasAnchorPair[] {
  const pairs: GasAnchorPair[] = [{ base: mount.baseAnchor, moving: mount.movingAnchor }];
  if (quantity < 2) return pairs;
  const offset = restOffset(base, moving);
  const center = offset.translation;
  const movingRest = applyRigid(offset, mount.movingAnchor);
  // 鏡写しの面の法線: 回転はピン方向、直進は動く向きに直交する横方向
  // 回転: 扉の中心を通りピンに垂直な面で鏡写し。直進: ガイドを通り横方向に垂直な面で鏡写し（ガイドの両脇に 1 本ずつ）
  let normal = normalize(joint.axis);
  let plane = center;
  if (joint.kind === 'prismatic') {
    const axes = linearAxes(base, moving, joint);
    normal = unitAxis(axes.l, 1);
    const onRail: [number, number, number] = [center[0], center[1], center[2]];
    onRail[axes.l] = axes.railLateral;
    plane = onRail;
  }
  const mirror = (p: Vec3): Vec3 => add(p, scale(normal, 2 * dot(sub(plane, p), normal)));
  const back = invertRigid(offset);
  pairs.push({ base: mirror(mount.baseAnchor), moving: applyRigid(back, mirror(movingRest)) });
  return pairs;
}

/** base ローカルで、可動量（回転は度、直進は mm）のときの動く側の点 */
export function movingAnchorAt(joint: MovableJoint, restPoint: Vec3, deg: number): Vec3 {
  const axis = normalize(joint.axis);
  if (joint.kind === 'prismatic') return add(restPoint, scale(axis, deg));
  const rad = (deg * Math.PI) / 180;
  const p = sub(restPoint, joint.origin);
  const along = scale(axis, dot(axis, p));
  const perp = sub(p, along);
  const rotated = add(add(scale(perp, Math.cos(rad)), scale(cross(axis, perp), Math.sin(rad))), along);
  return add(joint.origin, rotated);
}

export interface GasMountSolution {
  baseAnchor: Vec3;
  movingAnchor: Vec3;
  /** 閉じた状態と開ききった状態の長さ */
  closedLength: number;
  openLength: number;
  /** 伸縮範囲内で目標の角度まで開けるか */
  reachesTarget: boolean;
}

/**
 * 取付点を自動で決める。
 *
 * 扉の回転面（ピンに垂直な面）で、固定側の点 A と扉側の点 P を格子探索する。
 *   - 閉じた状態で縮みきりより少し長い（底付きしない）
 *   - 目標の角度で伸びきり付近（ガススプリングが開きのストッパーになる）
 *   - 開くほど長くなる（押し出し型は開く向きに押し、ダンパーは閉じる動きを受け止める）
 * のうち、ストロークを最も使い切り、取付が扉の縁に寄りすぎないものを選ぶ。
 */
export interface GasBalanceInput {
  /** 角度 deg での重力によるトルク N·m（開く向きが正） */
  gravityTorque: (deg: number) => number;
  /** 付ける本数 */
  quantity: number;
  /** 取付点間の長さ mm から 軸力 N（押し広げる向きが正） */
  force: (lengthMm: number) => number;
}

export function solveGasMount(
  project: Project,
  joint: MovableJoint,
  spec: GasSpringSpec,
  target = joint.range.max,
  balance?: GasBalanceInput,
): GasMountSolution | null {
  return joint.kind === 'revolute'
    ? solveHingeGasMount(project, joint, spec, target, balance)
    : solveLinearGasMount(project, joint, spec);
}

/** 直進の可動の軸: a = 動く向き / n = 固定側から動く側へ向かう取付面の法線 / l = 横方向 */
export interface LinearAxes {
  a: 0 | 1 | 2;
  signA: 1 | -1;
  n: 0 | 1 | 2;
  towardMoving: 1 | -1;
  l: 0 | 1 | 2;
  /** 固定側の面と動く側の面の、n 方向の座標（base ローカル） */
  baseFace: number;
  movingFace: number;
  /** レール（ガイド）の横方向の位置。固定側の面の中に収める */
  railLateral: number;
  bounds: { min: Vec3; max: Vec3 };
}

export function linearAxes(base: Part, moving: Part, joint: PrismaticJoint): LinearAxes {
  const offset = restOffset(base, moving);
  const bounds = movingBounds(offset, moving);
  const bh = half(base);
  const center = offset.translation;
  const axis = normalize(joint.axis);
  const a = ([0, 1, 2] as const).reduce((best, i) => (Math.abs(axis[i]!) > Math.abs(axis[best]!) ? i : best), 0);
  const others = ([0, 1, 2] as const).filter((i) => i !== a);
  // 取付面の法線: 固定側と動く側が重ならない（離れている）方向
  const overlap = (i: number): number => Math.min(bh[i]!, bounds.max[i]!) - Math.max(-bh[i]!, bounds.min[i]!);
  const n = others.reduce((best, i) => (overlap(i) < overlap(best) ? i : best));
  const l = others.find((i) => i !== n)!;
  const towardMoving = center[n]! >= 0 ? 1 : -1;
  return {
    a, signA: axis[a]! >= 0 ? 1 : -1, n, towardMoving, l,
    baseFace: towardMoving * bh[n]!,
    movingFace: towardMoving > 0 ? bounds.min[n]! : bounds.max[n]!,
    railLateral: Math.min(Math.max(center[l]!, -bh[l]!), bh[l]!),
    bounds,
  };
}

/**
 * 直進（リニアガイド・レール）のガススプリング。動く向きと平行に、ガイドの横に付ける。
 * ボディを下（動く向きの手前）、ロッドを動く側に付け、可動量 0 で縮みきり + 3mm。
 * 動いた量だけ伸びるので、伸縮範囲がそのまま可動範囲の上限になる。
 * ボディの下端は、動かない部材（柱・床板など）に留められる位置でなければならない。
 */
function solveLinearGasMount(project: Project, joint: PrismaticJoint, spec: GasSpringSpec): GasMountSolution | null {
  const base = project.parts.find((part) => part.id === joint.basePartId);
  const moving = project.parts.find((part) => part.id === joint.movingPartId);
  if (!base || !moving) return null;
  const offset = restOffset(base, moving);
  const axis = normalize(joint.axis);
  const { a, signA, n, towardMoving, l, baseFace, movingFace, railLateral, bounds } = linearAxes(base, moving, joint);
  const gap = Math.abs(movingFace - baseFace);

  const moved = movingSubtree(project, moving.id);
  const invBase = invertRigid(rigidFromTransform(base.transform));
  const baseRigid = rigidFromTransform(base.transform);
  const staticParts = project.parts.filter((part) => !moved.has(part.id));
  let staticLow = Infinity;
  for (const part of staticParts) {
    const b = movingBounds(composeRigid(invBase, rigidFromTransform(part.transform)), part);
    staticLow = Math.min(staticLow, signA > 0 ? b.min[a]! : -b.max[a]!);
  }
  const closed = spec.strokeMin + 3;
  const movingLow = signA > 0 ? bounds.min[a]! : -bounds.max[a]!;
  const movingHigh = signA > 0 ? bounds.max[a]! : -bounds.min[a]!;
  const along = Math.max(movingLow + 20, staticLow + closed);
  if (along > movingHigh - 5) return null;

  // ガイドの横（ブロック幅の半分 + ボディ半径 + 余裕）に並べる。動く側の幅に収まる側を選ぶ
  const side = 32;
  const lateral = [railLateral + side, railLateral - side, railLateral]
    .find((value) => value >= bounds.min[l]! + 5 && value <= bounds.max[l]! - 5) ?? railLateral + side;
  const p: [number, number, number] = [0, 0, 0];
  p[a] = signA * along;
  p[n] = baseFace + towardMoving * Math.min(15, gap / 2);
  p[l] = lateral;
  const anchor = sub(p, scale(axis, closed));

  // 下端（ボディ側）を留める部材があるか
  const world = applyRigid(baseRigid, anchor);
  const supported = staticParts.some((part) => surfaceDistance(applyRigid(invertRigid(rigidFromTransform(part.transform)), world), half(part)) <= 30);
  if (!supported) return null;

  return {
    baseAnchor: anchor,
    movingAnchor: applyRigid(invertRigid(offset), p),
    closedLength: closed,
    openLength: Math.min(closed + joint.range.max, spec.strokeMax),
    reachesTarget: closed + joint.range.max <= spec.strokeMax + 0.5,
  };
}

function solveHingeGasMount(
  project: Project,
  joint: RevoluteJoint,
  spec: GasSpringSpec,
  targetDeg = joint.range.max,
  balance?: GasBalanceInput,
): GasMountSolution | null {
  const base = project.parts.find((part) => part.id === joint.basePartId);
  const moving = project.parts.find((part) => part.id === joint.movingPartId);
  if (!base || !moving) return null;
  const offset = restOffset(base, moving);
  const axis = normalize(joint.axis);
  const center = offset.translation;
  const toCenter = sub(center, joint.origin);
  const into = normalize(sub(toCenter, scale(axis, dot(axis, toCenter))));
  // 扉の裏側（箱の内側）。開く向きの初速と反対
  const back = scale(normalize(cross(axis, into)), -1);
  const doorDepth = Math.max(dot(toCenter, into) * 2, 50);

  // 固定側の点は、動かない部材の外接箱の内側に限る
  const moved = movingSubtree(project, moving.id);
  const invBase = invertRigid(rigidFromTransform(base.transform));
  const staticBox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const staticBounds: Array<{ min: Vec3; max: Vec3 }> = [];
  for (const part of project.parts) {
    if (moved.has(part.id)) continue;
    const bounds = movingBounds(composeRigid(invBase, rigidFromTransform(part.transform)), part);
    staticBounds.push(bounds);
    for (let i = 0; i < 3; i += 1) {
      staticBox.min[i] = Math.min(staticBox.min[i]!, bounds.min[i]!);
      staticBox.max[i] = Math.max(staticBox.max[i]!, bounds.max[i]!);
    }
  }

  // 取付面: 固定側のブラケットは側板の内側の面にネジ留めする。
  // ピン方向で扉の中心より片側にある部材（側板）の内側の面から 15mm 離れた面で動く。
  // 側板が無ければ、扉の端から 60mm 内側
  const h = half(moving);
  const alongExtent = [0, 1, 2].reduce((sum, i) => sum + Math.abs(dot(axis, column(offset.rotation, i as 0 | 1 | 2))) * h[i]!, 0);
  const centerAlong = dot(axis, center);
  const axisIndex = [0, 1, 2].reduce((best, i) => (Math.abs(axis[i]!) > Math.abs(axis[best]!) ? i : best), 0);
  const aligned = Math.abs(axis[axisIndex]!) > 0.95;
  const axisSign = axis[axisIndex]! >= 0 ? 1 : -1;
  let planeAlong = centerAlong - Math.max(alongExtent - 60, 0);
  if (aligned) {
    let bestFace = -Infinity;
    for (const bounds of staticBounds) {
      // 軸方向の座標（軸の向きに合わせて符号をそろえる）
      const lo = axisSign > 0 ? bounds.min[axisIndex]! : -bounds.max[axisIndex]!;
      const hi = axisSign > 0 ? bounds.max[axisIndex]! : -bounds.min[axisIndex]!;
      const inner = hi;
      if (hi < centerAlong - 50 && inner > centerAlong - alongExtent - 40 && lo < inner && inner > bestFace) bestFace = inner;
    }
    if (bestFace > -Infinity) planeAlong = bestFace + 15;
  }
  const planeOrigin = add(joint.origin, scale(axis, planeAlong - dot(axis, joint.origin)));
  const insideStatic = (p: Vec3): boolean => p.every((v, i) => v >= staticBox.min[i]! - 1 && v <= staticBox.max[i]! + 1);

  const minLen = spec.strokeMin;
  const maxLen = spec.strokeMax;
  const stroke = maxLen - minLen;
  const reach = Math.max(maxLen, doorDepth) * 1.1;
  const step = Math.max(5, Math.round(reach / 45));
  const angles = Array.from({ length: 9 }, (_, i) => joint.range.min + ((targetDeg - joint.range.min) * i) / 8);
  const gravity = balance ? angles.map((deg) => balance.gravityTorque(deg)) : [];
  const velocities = (p: Vec3): Vec3 => cross(axis, sub(p, joint.origin));

  let best: { score: number; solution: GasMountSolution } | null = null;
  for (let pu = 20; pu <= doorDepth - 10; pu += step) {
    const pRest = add(planeOrigin, scale(into, pu));
    const pts = angles.map((deg) => movingAnchorAt(joint, pRest, deg));
    for (let au = -reach * 0.3; au <= reach; au += step) {
      for (let ab = 10; ab <= reach; ab += step) {
        const a = add(add(planeOrigin, scale(into, au)), scale(back, ab));
        const lengths = pts.map((p) => length(sub(p, a)));
        const closed = lengths[0]!;
        const open = lengths[lengths.length - 1]!;
        if (closed < minLen + 3 || open > maxLen + 0.5) continue;
        let monotonic = true;
        for (let i = 1; i < lengths.length; i += 1) if (lengths[i]! < lengths[i - 1]! - 0.2) monotonic = false;
        if (!monotonic) continue;
        if (!insideStatic(a)) continue;
        const used = (open - closed) / stroke;
        const endGap = maxLen - open;
        // ストロークを使い切り、伸びきりで開きが止まる形を優先。取付点は扉の中ほどまで
        let score = used * 10 - endGap / 20 - Math.abs(pu / doorDepth - 0.35) * 2 - ab / reach;
        if (balance) {
          // 持ち上げ補助は「閉じたら閉じたまま、開けたら開いたまま」が理想。
          // 閉じた状態で勝手に開く・開いた状態で落ちてくる分だけ減点する
          const net = (index: number): number => {
            const p = pts[index]!;
            const d = sub(p, a);
            const dLdTheta = dot(d, velocities(p)) / Math.max(lengths[index]!, 1e-9);
            return gravity[index]! + balance.quantity * balance.force(lengths[index]!) * dLdTheta / 1000;
          };
          score -= Math.max(net(0), 0) * 4 + Math.max(-net(angles.length - 1), 0) * 4;
        }
        if (!best || score > best.score) {
          best = {
            score,
            solution: {
              baseAnchor: a,
              movingAnchor: applyRigid(invertRigid(offset), pRest),
              closedLength: closed,
              openLength: open,
              reachesTarget: endGap < 3,
            },
          };
        }
      }
    }
  }
  return best?.solution ?? null;
}

// ------------------------------------------------------------
// 穴（自動加工）の位置
// ------------------------------------------------------------

export interface HolePlacement {
  partId: PartId;
  /** 部材ローカル */
  position: Vec3;
  /** 掘り始める面 */
  face: { axis: 0 | 1 | 2; sign: 1 | -1 };
}

/**
 * base ローカルの点に、いちばん近い部材の表面を探す。
 * 候補は target 側（固定側なら動かない部材、可動側なら扉とその子）に限る。
 */
export function placeHole(
  base: Part,
  pointBase: Vec3,
  candidates: readonly Part[],
  fallback: Part,
  toward: Vec3,
): HolePlacement {
  const baseRigid = rigidFromTransform(base.transform);
  const world = applyRigid(baseRigid, pointBase);
  let best: { part: Part; local: Vec3; distance: number } | null = null;
  for (const part of candidates) {
    const local = applyRigid(invertRigid(rigidFromTransform(part.transform)), world);
    const distance = surfaceDistance(local, half(part));
    if (!best || distance < best.distance) best = { part, local, distance };
  }
  const chosen = best && best.distance < 30 ? best : {
    part: fallback,
    local: applyRigid(invertRigid(rigidFromTransform(fallback.transform)), world),
  };
  const towardLocal = applyRigid(invertRigid(rigidFromTransform(chosen.part.transform)), applyRigid(baseRigid, toward));
  return { partId: chosen.part.id, position: chosen.local, face: faceToward(half(chosen.part), towardLocal) };
}

export const isRevolute = (joint: Joint | undefined): joint is RevoluteJoint => joint?.kind === 'revolute';
export const isPrismatic = (joint: Joint | undefined): joint is PrismaticJoint => joint?.kind === 'prismatic';

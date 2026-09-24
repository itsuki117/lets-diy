import { applyRigid } from '../math/rigid';
import { cross, dot, length, normalize, sub } from '../math/vec3';
import { gasAnchorPairs, movingAnchorAt, restOffset } from '../hardware/mechanism';
import type { GasSpringMount, GasSpringSpec, GasSpringType, MovableJoint, Project, Vec3 } from '../types';

/**
 * ガススプリング / ダンパーの力のモデル（設計書 DESIGN_V2 §8）。
 *
 * 実物の性質:
 * - 力はロッドを押し込むほど増える（F2/F1 = 1.2〜1.4 のプログレッション）。
 *   押し込んだロッドの体積ぶん窒素が圧縮されるため
 * - シールの摩擦があり、縮めるときの力 > 伸びるときの力（ヒステリシス。目安 F1 の 10%）
 * - ピストンの絞りを油とガスが通るので、速く動かすほど抵抗が大きい（速度に比例する減衰）
 * - ロッドを下向きに付けると、伸びきり手前でピストンが油に入り、急に遅くなる（エンドダンピング）
 * - 伸びきり長さより長く、縮みきり長さより短くはならない（機械的な上限・下限）
 * - 引張型は縮む向きに力を出す。ロック付はロック中、長さが変わらない
 * - 油圧ダンパーはガス圧がほとんど無く、速度に比例した抵抗だけで動きを遅くする
 */

export interface ResolvedGasSpec {
  strokeMin: number;
  strokeMax: number;
  forceN: number;
  type: GasSpringType;
  progression: number;
  /** 減衰係数 N/(mm/s)（伸びる向き） */
  dampingExtend: number;
  /** 減衰係数 N/(mm/s)（縮む向き） */
  dampingCompress: number;
  /** シール摩擦 N */
  frictionN: number;
}

export const GAS_TYPE_LABELS: Record<GasSpringType, string> = {
  push: '押し出し型',
  traction: '引張型',
  damper: '油圧ダンパー',
  locking: 'ロック付',
};

/** ダンパーの extendSpeed は「100N をかけたときの速度」として扱う */
const DAMPER_REFERENCE_N = 100;
/** エンドダンピングがかかる、伸びきり手前の長さ mm */
export const END_DAMPING_ZONE_MM = 15;
const END_DAMPING_FACTOR = 6;

export function resolveGasSpec(spec: GasSpringSpec | GasSpringMount): ResolvedGasSpec {
  const type = spec.type ?? 'push';
  const speed = spec.extendSpeed ?? (type === 'damper' ? 25 : 200);
  const base = (type === 'damper' ? DAMPER_REFERENCE_N : spec.forceN) / speed;
  const direction = spec.dampDirection ?? 'both';
  return {
    strokeMin: spec.strokeMin,
    strokeMax: spec.strokeMax,
    forceN: spec.forceN,
    type,
    progression: spec.progression ?? (type === 'damper' ? 1.1 : 1.3),
    dampingExtend: direction === 'compress' ? base * 0.05 : base,
    // ガススプリングは縮める向きの絞りが緩い。ダンパーは指定どおり
    dampingCompress: type === 'damper'
      ? (direction === 'extend' ? base * 0.05 : base)
      : base * 0.5,
    frictionN: Math.max(spec.forceN * 0.1, 2),
  };
}

/**
 * ガス圧による軸力 N。正は取付点どうしを押し広げる向き。
 * 摩擦と減衰は速度で向きが変わるので、ここには含めない。
 */
export function gasStaticForce(spec: ResolvedGasSpec, lengthMm: number): number {
  const stroke = Math.max(spec.strokeMax - spec.strokeMin, 1e-6);
  const compressed = Math.min(Math.max((spec.strokeMax - lengthMm) / stroke, 0), 1);
  if (spec.type === 'traction') {
    // 引張型は引き伸ばすほど力が増える
    return -spec.forceN * (1 + (spec.progression - 1) * (1 - compressed));
  }
  return spec.forceN * (1 + (spec.progression - 1) * compressed);
}

/** 減衰係数 N/(mm/s)。伸びきり手前で、ロッドが下向きならエンドダンピングが効く */
export function gasDamping(spec: ResolvedGasSpec, lengthMm: number, rodSpeedMmS: number, rodDown: boolean): number {
  if (rodSpeedMmS >= 0) {
    const inEndZone = spec.strokeMax - lengthMm < END_DAMPING_ZONE_MM;
    return spec.dampingExtend * (inEndZone && rodDown && spec.type !== 'damper' ? END_DAMPING_FACTOR : 1);
  }
  return spec.dampingCompress;
}

// ------------------------------------------------------------
// joint に付いたガススプリングの幾何
// ------------------------------------------------------------

export interface JointGasSpring {
  mount: GasSpringMount;
  spec: ResolvedGasSpec;
  quantity: number;
  /** 固定側の取付点（base ローカル） */
  anchor: Vec3;
  /** 可動側の取付点（base ローカル、rest pose = 角度 0） */
  movingRest: Vec3;
  label: string;
}

export function jointGasSprings(project: Project, joint: MovableJoint): JointGasSpring[] {
  const base = project.parts.find((part) => part.id === joint.basePartId);
  const moving = project.parts.find((part) => part.id === joint.movingPartId);
  if (!base || !moving) return [];
  const offset = restOffset(base, moving);
  return project.gasSprings.flatMap((mount) => {
    if (mount.jointId !== joint.id) return [];
    const hardware = project.hardware.find((item) => item.id === mount.hardwareId);
    const quantity = hardware?.quantity ?? 1;
    // 左右 1 対は鏡写しなので長さの変化は同じ。代表 1 本で計算し、力を本数倍する
    const pair = gasAnchorPairs(mount, 1, joint, base, moving)[0]!;
    return [{
      mount,
      spec: resolveGasSpec(mount),
      quantity,
      anchor: pair.base,
      movingRest: applyRigid(offset, pair.moving),
      label: hardware?.preset.label ?? 'ガススプリング',
    }];
  });
}

/**
 * 可動量 value での取付点間の長さ mm と、可動量あたりの長さの変化
 * （回転は mm/rad、直進は mm/mm）
 */
export function gasLengthAt(joint: MovableJoint, spring: JointGasSpring, value: number): { lengthMm: number; dLdTheta: number; moving: Vec3 } {
  const moving = movingAnchorAt(joint, spring.movingRest, value);
  const d = sub(moving, spring.anchor);
  const lengthMm = length(d);
  const axis = normalize(joint.axis);
  const velocity = joint.kind === 'prismatic' ? axis : cross(axis, sub(moving, joint.origin));
  return { lengthMm, dLdTheta: lengthMm > 1e-9 ? dot(d, velocity) / lengthMm : 0, moving };
}

const LIMIT_TOLERANCE_MM = 0.5;

const feasibleAt = (joint: MovableJoint, springs: readonly JointGasSpring[], deg: number): boolean =>
  springs.every((spring) => {
    const { lengthMm } = gasLengthAt(joint, spring, deg);
    return lengthMm >= spring.spec.strokeMin - LIMIT_TOLERANCE_MM && lengthMm <= spring.spec.strokeMax + LIMIT_TOLERANCE_MM;
  });

export interface LimitedRange {
  min: number;
  max: number;
  /** 下限・上限を決めているもの。丁番の可動範囲そのものなら null */
  minReason: string | null;
  maxReason: string | null;
}

/**
 * ガススプリングの伸縮範囲で制限された、実際に動ける範囲（角度 / 移動量）。
 * 丁番の可動範囲の中で、現在の角度を含む連続区間を返す。
 * ロック中のロック付ガススプリングがあれば、現在の角度から動けない。
 */
export function gasLimitedRange(project: Project, joint: MovableJoint): LimitedRange {
  const springs = jointGasSprings(project, joint);
  const { min, max } = joint.range;
  if (springs.length === 0) return { min, max, minReason: null, maxReason: null };
  if (springs.some((spring) => spring.spec.type === 'locking' && spring.mount.locked)) {
    return { min: joint.value, max: joint.value, minReason: 'ロック中', maxReason: 'ロック中' };
  }

  const step = joint.kind === 'revolute' ? 0.25 : 0.5;
  const count = Math.max(1, Math.ceil((max - min) / step));
  const at = (i: number): number => min + ((max - min) * i) / count;
  const start = Math.min(Math.max(joint.value, min), max);
  let index = Math.round(((start - min) / Math.max(max - min, 1e-9)) * count);
  if (!feasibleAt(joint, springs, at(index))) {
    // 今の角度が範囲外（取付を変えた直後など）なら、いちばん近い成立区間へ
    let found = -1;
    for (let d = 1; d <= count && found < 0; d += 1) {
      if (index - d >= 0 && feasibleAt(joint, springs, at(index - d))) found = index - d;
      else if (index + d <= count && feasibleAt(joint, springs, at(index + d))) found = index + d;
    }
    if (found < 0) return { min: start, max: start, minReason: '伸縮範囲に収まりません', maxReason: '伸縮範囲に収まりません' };
    index = found;
  }
  let lo = index;
  while (lo > 0 && feasibleAt(joint, springs, at(lo - 1))) lo -= 1;
  let hi = index;
  while (hi < count && feasibleAt(joint, springs, at(hi + 1))) hi += 1;

  const refine = (inside: number, outside: number): number => {
    let a = inside;
    let b = outside;
    for (let i = 0; i < 20; i += 1) {
      const mid = (a + b) / 2;
      if (feasibleAt(joint, springs, mid)) a = mid;
      else b = mid;
    }
    return a;
  };
  const lower = lo > 0 ? refine(at(lo), at(lo - 1)) : min;
  const upper = hi < count ? refine(at(hi), at(hi + 1)) : max;
  const reasonAt = (deg: number): string => {
    const nearMax = springs.some((spring) => spring.spec.strokeMax - gasLengthAt(joint, spring, deg).lengthMm < 1);
    return nearMax ? 'ガススプリングが伸びきり' : 'ガススプリングが縮みきり';
  };
  return {
    min: lower,
    max: upper,
    minReason: lower > min + 0.01 ? reasonAt(lower) : null,
    maxReason: upper < max - 0.01 ? reasonAt(upper) : null,
  };
}

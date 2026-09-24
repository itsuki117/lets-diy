import { GRAVITY, MATERIAL_DENSITY } from '../constants';
import { movingAnchorAt, movingSubtree } from '../hardware/mechanism';
import { applyMat3, transpose } from '../math/matrix';
import { applyRigid, composeRigid, invertRigid, rigidFromTransform } from '../math/rigid';
import { cross, dot, length, normalize, scale, sub } from '../math/vec3';
import { isMovableJoint, type JointId, type MovableJoint, type Project, type Vec3 } from '../types';
import { gasDamping, gasLengthAt, gasStaticForce, jointGasSprings, type JointGasSpring } from './gasSpring';
import { motionLimits } from './limits';
import { solvePoses } from './kinematics';

/**
 * 手を離したあとの動き（設計書 DESIGN_V2 §9.4）。
 *
 * 1 自由度の剛体として、重力・ガススプリング・減衰・摩擦・当たり止めで動かす。
 *   回転: I * dω/dt = 重力のトルク(θ) + Σ F(L) * dL/dθ - b * ω - 摩擦
 *   直進: m * dv/dt = 重力の軸方向成分 - b * v - 摩擦
 * ガススプリングの力は仮想仕事から τ = F·dL/dθ（取付点の幾何だけで決まる）。
 * 減衰は陰的に、摩擦は「止まるなら止める」で扱うので、硬い減衰でも発散しない。
 */

export interface MotionLimits {
  min: number;
  max: number;
  minReason: string | null;
  maxReason: string | null;
}

export interface MotionModel {
  jointId: JointId;
  kind: MovableJoint['kind'];
  /** 動く側（子も含む）の質量 kg */
  massKg: number;
  /** 実際に動ける範囲（金物の可動範囲とガススプリングの伸縮で決まる） */
  limits: MotionLimits;
  /** 回転軸から、動く側でいちばん遠い点までの距離 m（手で持つ位置の目安） */
  handleRadiusM: number;
  springs: JointGasSpring[];
  /** 値 q（度 / mm）での、速度に依らない力（N·m / N）と摩擦の大きさ */
  staticLoad: (q: number) => { drive: number; gravity: number; spring: number; friction: number };
  /** 1 ステップ進める。v は 度/s または mm/s */
  step: (state: MotionState, dt: number) => MotionState;
}

export interface MotionState {
  q: number;
  v: number;
  /** 止まったまま経過した時間 s */
  restTime: number;
  /** 直前のステップで当たり止めに当たったか */
  hitStop: boolean;
}

const HINGE_FRICTION_NM = 0.08;
const HINGE_VISCOUS = 0.01;
const RAIL_FRICTION_BASE_N = 3;
const RAIL_ROLLING = 0.02;
const RAIL_VISCOUS = 4;
const RESTITUTION_STOP = 0.12;
/** これより遅く当たったら跳ね返らない（回転 rad/s / 直進 m/s） */
const BOUNCE_MIN = { revolute: 0.3, prismatic: 0.1 };

interface MassPoint {
  massKg: number;
  /** 重心（base ローカル mm、現在の値のとき） */
  center: Vec3;
  /** 回転軸まわりの重心まわり慣性 kg·m² */
  axisInertia: number;
  corners: Vec3[];
}

export function buildMotionModel(project: Project, jointId: JointId): MotionModel | null {
  const joint = project.joints.find((item) => item.id === jointId);
  if (!joint || !isMovableJoint(joint)) return null;
  const base = project.parts.find((part) => part.id === joint.basePartId);
  if (!base) return null;

  const poses = solvePoses(project).poses;
  const baseWorld = rigidFromTransform(poses.get(base.id) ?? base.transform);
  const toBase = invertRigid(baseWorld);
  const gravityLocal = applyMat3(transpose(baseWorld.rotation), [0, -GRAVITY, 0]);
  const axis = normalize(joint.axis);
  const subtree = movingSubtree(project, joint.movingPartId);

  const points: MassPoint[] = project.parts.filter((part) => subtree.has(part.id)).map((part) => {
    const local = composeRigid(toBase, rigidFromTransform(poses.get(part.id) ?? part.transform));
    const massKg = part.size.x * part.size.y * part.size.z * 1e-9 * MATERIAL_DENSITY[part.material];
    const partAxis = applyMat3(transpose(local.rotation), axis);
    const [sx, sy, sz] = [part.size.x / 1000, part.size.y / 1000, part.size.z / 1000];
    const inertiaDiag: Vec3 = [massKg * (sy * sy + sz * sz) / 12, massKg * (sx * sx + sz * sz) / 12, massKg * (sx * sx + sy * sy) / 12];
    const axisInertia = partAxis[0] ** 2 * inertiaDiag[0] + partAxis[1] ** 2 * inertiaDiag[1] + partAxis[2] ** 2 * inertiaDiag[2];
    const h: Vec3 = [part.size.x / 2, part.size.y / 2, part.size.z / 2];
    const corners: Vec3[] = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) corners.push(applyRigid(local, [a * h[0], b * h[1], c * h[2]]));
    return { massKg, center: local.translation, axisInertia, corners };
  });
  const massKg = Math.max(points.reduce((sum, p) => sum + p.massKg, 0), 1e-3);

  const springs = jointGasSprings(project, joint);
  const range = motionLimits(project, joint);
  /**
   * ガススプリングの力。回転は q = 度・速度 rad/s でトルク N·m、直進は q = mm・速度 mm/s で力 N。
   * forceScale / dampScale は mm を SI に直す係数。
   */
  const forceScale = joint.kind === 'revolute' ? 1 / 1000 : 1;
  const dampScale = joint.kind === 'revolute' ? 1 / 1000 : 1000;
  const springAt = (q: number, speed: number): { drive: number; friction: number; damping: number } => {
    let drive = 0;
    let friction = 0;
    let damping = 0;
    for (const spring of springs) {
      const { lengthMm, dLdTheta, moving } = gasLengthAt(joint, spring, q);
      const rodAtMoving = (spring.mount.rodEnd ?? 'moving') === 'moving';
      const rodWorld = applyRigid(baseWorld, rodAtMoving ? moving : spring.anchor);
      const bodyWorld = applyRigid(baseWorld, rodAtMoving ? spring.anchor : moving);
      const rodDown = rodWorld[1] < bodyWorld[1];
      const c = gasDamping(spring.spec, lengthMm, dLdTheta * speed, rodDown);
      drive += spring.quantity * gasStaticForce(spring.spec, lengthMm) * dLdTheta * forceScale;
      friction += spring.quantity * spring.spec.frictionN * Math.abs(dLdTheta) * forceScale;
      damping += spring.quantity * c * dLdTheta * dLdTheta * dampScale;
    }
    return { drive, friction, damping };
  };

  if (joint.kind === 'prismatic') {
    const gravityForce = massKg * dot(gravityLocal, axis);
    const railFriction = RAIL_FRICTION_BASE_N + RAIL_ROLLING * massKg * GRAVITY;
    return {
      jointId, kind: 'prismatic', massKg, limits: range, handleRadiusM: 0, springs,
      staticLoad: (q) => {
        const spring = springAt(q, 0);
        return { drive: gravityForce + spring.drive, gravity: gravityForce, spring: spring.drive, friction: railFriction + spring.friction };
      },
      step: (state, dt) => integrate(state, dt, {
        inertia: massKg,
        toSi: 1 / 1000,
        load: (q, v) => {
          const spring = springAt(q, v);
          return { drive: gravityForce + spring.drive, friction: railFriction + spring.friction, damping: RAIL_VISCOUS + spring.damping };
        },
        limits: range,
        bounceMin: BOUNCE_MIN.prismatic,
      }),
    };
  }

  // 回転: 値 q0（現在）での重心を、軸まわりに (q - q0) だけ回す
  const q0 = joint.value;
  const origin = joint.origin;
  const inertia = Math.max(points.reduce((sum, p) => {
    const r = sub(p.center, origin);
    const perp = sub(r, scale(axis, dot(r, axis)));
    return sum + p.axisInertia + p.massKg * (dot(perp, perp) / 1e6);
  }, 0), 1e-5);
  const handleRadiusM = Math.max(...points.flatMap((p) => p.corners.map((corner) => {
    const r = sub(corner, origin);
    return length(sub(r, scale(axis, dot(r, axis))));
  })), 1) / 1000;

  const gravityAt = (q: number): number => points.reduce((sum, p) => {
    const center = movingAnchorAt(joint, p.center, q - q0);
    return sum + dot(axis, cross(sub(center, origin), scale(gravityLocal, p.massKg))) / 1000;
  }, 0);
  const toRad = Math.PI / 180;

  return {
    jointId, kind: 'revolute', massKg, limits: range, handleRadiusM, springs,
    staticLoad: (q) => {
      const gravity = gravityAt(q);
      const spring = springAt(q, 0);
      return { drive: gravity + spring.drive, gravity, spring: spring.drive, friction: spring.friction + HINGE_FRICTION_NM };
    },
    step: (state, dt) => integrate(state, dt, {
      inertia,
      toSi: toRad,
      load: (q, v) => {
        const spring = springAt(q, v * toRad);
        return {
          drive: gravityAt(q) + spring.drive,
          friction: spring.friction + HINGE_FRICTION_NM,
          damping: spring.damping + HINGE_VISCOUS,
        };
      },
      limits: range,
      bounceMin: BOUNCE_MIN.revolute,
    }),
  };
}

interface IntegrateInput {
  inertia: number;
  /** 値の単位 から SI（度->rad、mm->m） */
  toSi: number;
  load: (q: number, v: number) => { drive: number; friction: number; damping: number };
  limits: MotionLimits;
  bounceMin: number;
}

/** 半陰的オイラー。減衰は陰的、クーロン摩擦は速度が反転するなら 0 で止める */
function integrate(state: MotionState, dt: number, input: IntegrateInput): MotionState {
  const { inertia, toSi, limits } = input;
  let v = state.v * toSi;
  const { drive, friction, damping } = input.load(state.q, state.v);
  v = (v + (dt * drive) / inertia) / (1 + (dt * damping) / inertia);
  const frictionDv = (dt * friction) / inertia;
  v = Math.abs(v) <= frictionDv ? 0 : v - Math.sign(v) * frictionDv;

  let q = state.q + (v / toSi) * dt;
  let hitStop = false;
  // 当たり止め: 速ければ少し跳ね返り、遅ければそこで止まる（押し付けられたまま静止）。
  // ガススプリングの伸びきり・縮みきりは油で受けるので跳ね返らない
  const bounce = (reason: string | null): number => (!reason && Math.abs(v) > input.bounceMin ? -v * RESTITUTION_STOP : 0);
  if (q <= limits.min) {
    q = limits.min;
    if (v < 0) {
      hitStop = Math.abs(state.q - limits.min) > 1e-9 || Math.abs(v) > 1e-6;
      v = bounce(limits.minReason);
    }
  } else if (q >= limits.max) {
    q = limits.max;
    if (v > 0) {
      hitStop = Math.abs(state.q - limits.max) > 1e-9 || Math.abs(v) > 1e-6;
      v = bounce(limits.maxReason);
    }
  }
  const vOut = v / toSi;
  const still = Math.abs(vOut) < (toSi === 1 / 1000 ? 0.5 : 0.05);
  return { q, v: vOut, restTime: still ? state.restTime + dt : 0, hitStop };
}

export type BalanceState = 'opens' | 'closes' | 'holds';

export interface BalancePoint {
  q: number;
  state: BalanceState;
  /** 手で支えるのに要る力 N（持ち手の位置で）。止まる位置は 0 */
  handForceN: number;
  gravity: number;
  spring: number;
}

/**
 * 各位置で手を離したらどうなるか。
 * 重力とガス圧の合計が摩擦を超えなければ、その位置で止まる。
 */
export function balanceCurve(model: MotionModel, steps = 60): BalancePoint[] {
  const { min, max } = model.limits;
  const count = Math.max(1, steps);
  return Array.from({ length: count + 1 }, (_, i) => {
    const q = min + ((max - min) * i) / count;
    const load = model.staticLoad(q);
    const excess = Math.abs(load.drive) - load.friction;
    const state: BalanceState = excess <= 0 ? 'holds' : load.drive > 0 ? 'opens' : 'closes';
    const arm = model.kind === 'revolute' ? Math.max(model.handleRadiusM, 0.01) : 1;
    return { q, state, handForceN: Math.max(excess, 0) / arm, gravity: load.gravity, spring: load.spring };
  });
}

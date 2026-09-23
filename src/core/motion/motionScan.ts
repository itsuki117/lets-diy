import { MOTION_SCAN_STEPS } from '../constants';
import { findInterferences, type InterferencePair } from '../collision/interference';
import { isMovableJoint, type JointId, type Project } from '../types';
import { applyPoses, solvePoses } from './kinematics';

/**
 * 可動範囲を走査して、どこでぶつかるかを調べる（設計書 DESIGN_V2 §9）。
 *
 * 各ステップで姿勢を解き直し、Ver.1 の OBB 干渉判定にかけるだけ。
 * 新しい幾何計算は要らない。
 */

export interface MotionBlock {
  fromValue: number;
  toValue: number;
  pairs: InterferencePair[];
}

export interface MotionScanResult {
  jointId: JointId;
  /** 走査した分割数 */
  steps: number;
  /** ぶつかる区間 */
  blocked: MotionBlock[];
  /** 実際に動かせる範囲。全域でぶつかるなら null */
  usable: { min: number; max: number } | null;
  /** 走査にかかった時間 ms */
  durationMs: number;
}

interface Sample {
  value: number;
  pairs: InterferencePair[];
}

const round = (v: number): number => Math.round(v * 100) / 100;

/** 連続してぶつかっているサンプルを 1 区間にまとめる */
function toBlocks(samples: readonly Sample[]): MotionBlock[] {
  const blocks: MotionBlock[] = [];
  let current: MotionBlock | null = null;

  for (const sample of samples) {
    if (sample.pairs.length === 0) {
      current = null;
      continue;
    }
    if (current) {
      current.toValue = round(sample.value);
      // 区間の代表として、最も深く食い込んでいる組み合わせを残す
      for (const pair of sample.pairs) {
        const existing = current.pairs.find((p) => p.a === pair.a && p.b === pair.b);
        if (!existing) current.pairs.push(pair);
        else if (pair.depthMm > existing.depthMm) existing.depthMm = pair.depthMm;
      }
      continue;
    }
    current = { fromValue: round(sample.value), toValue: round(sample.value), pairs: [...sample.pairs] };
    blocks.push(current);
  }
  return blocks;
}

/**
 * 動かせる範囲。
 * 閉じた側（range.min）から連続して空いている区間を優先する。
 * 扉は閉じた状態から開くので、そこが繋がっていないと実用にならない。
 */
function toUsable(samples: readonly Sample[]): { min: number; max: number } | null {
  const free: Array<{ min: number; max: number }> = [];
  let current: { min: number; max: number } | null = null;
  for (const sample of samples) {
    if (sample.pairs.length > 0) {
      current = null;
      continue;
    }
    if (current) current.max = round(sample.value);
    else {
      current = { min: round(sample.value), max: round(sample.value) };
      free.push(current);
    }
  }
  if (free.length === 0) return null;

  const first = free[0]!;
  const startValue = samples[0]?.value ?? 0;
  if (Math.abs(first.min - round(startValue)) < 1e-6) return first;

  // 閉じた側が塞がっているときは、いちばん広く空いている区間を返す
  return free.reduce((best, entry) => (entry.max - entry.min > best.max - best.min ? entry : best), first);
}

export function scanJointMotion(
  project: Project,
  jointId: JointId,
  steps: number = MOTION_SCAN_STEPS,
): MotionScanResult {
  const started = performance.now();
  const joint = project.joints.find((j) => j.id === jointId);
  if (!joint || !isMovableJoint(joint)) {
    return { jointId, steps: 0, blocked: [], usable: null, durationMs: 0 };
  }

  const { min, max } = joint.range;
  const divisions = Math.max(1, Math.floor(steps));
  const samples: Sample[] = [];

  for (let i = 0; i <= divisions; i += 1) {
    const value = min + ((max - min) * i) / divisions;
    // joints だけ差し替えた軽いコピー。parts は共有のままでよい
    const posed: Project = {
      ...project,
      joints: project.joints.map((j) => (j.id === jointId && isMovableJoint(j) ? { ...j, value } : j)),
    };
    const { poses } = solvePoses(posed);
    samples.push({ value, pairs: findInterferences(applyPoses(project.parts, poses)) });
  }

  return {
    jointId,
    steps: divisions,
    blocked: toBlocks(samples),
    usable: toUsable(samples),
    durationMs: performance.now() - started,
  };
}

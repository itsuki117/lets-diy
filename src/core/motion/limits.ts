import type { Hardware, MovableJoint, Project } from '../types';
import { bracketLocked } from '../hardware/brackets';
import { gasLimitedRange, type LimitedRange } from './gasSpring';

/**
 * 実際に動ける範囲（設計書 DESIGN_V2 §10.4）。
 *
 * 次のすべてを満たす範囲:
 *   - 金物の可動範囲（丁番の最大角・レールやガイドのストローク）
 *   - ガススプリングの伸縮範囲（ロック付ならロック中は現在値だけ）
 *   - ドアロック（掛かっている間はロック位置だけ）
 *   - 固定金具（動く部材を固定側へ金具でつないでいたら動かない）
 */
export function motionLimits(project: Project, joint: MovableJoint): LimitedRange {
  if (bracketLocked(project, joint)) {
    return { min: joint.value, max: joint.value, minReason: '固定金具で固定', maxReason: '固定金具で固定' };
  }
  const engaged = jointLatches(project, joint.id).find((item) => item.latch?.engaged);
  if (engaged) return { min: joint.value, max: joint.value, minReason: 'ドアロック中', maxReason: 'ドアロック中' };
  return gasLimitedRange(project, joint);
}

export const jointLatches = (project: Project, jointId: string): Hardware[] =>
  project.hardware.filter((item) => item.preset.kind === 'latch' && item.jointId === jointId && item.latch);

/** ドアロックが掛かる位置。ロック自体を除いた可動範囲の端 */
export function latchValue(project: Project, joint: MovableJoint, at: 'min' | 'max'): number {
  const free = gasLimitedRange(project, joint);
  return at === 'max' ? free.max : free.min;
}

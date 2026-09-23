import { create } from 'zustand';
import { solvePoses } from '../core/motion/kinematics';
import type { PartId, Project, Transform } from '../core/types';

/**
 * joint から計算した各部材のワールド姿勢を持つ。
 *
 * `solvePoses` は毎フレームではなく、parts か joints が変わったときだけ呼ぶ
 * （設計書 DESIGN_V2 §7.1）。ここが崩れるとスライダー操作で fps が落ちる。
 */
export interface MotionStore {
  poses: Map<PartId, Transform>;
  problems: string[];
  /** 再計算した回数。デバッグと性能確認に使う */
  revision: number;
  recompute: (project: Project) => void;
}

export const useMotionStore = create<MotionStore>((set, get) => ({
  poses: new Map(),
  problems: [],
  revision: 0,
  recompute: (project) => {
    const result = solvePoses(project);
    set({ poses: result.poses, problems: result.problems, revision: get().revision + 1 });
  },
}));

/** 部材の表示姿勢。pose が無ければ rest pose をそのまま使う。 */
export const poseOf = (poses: Map<PartId, Transform>, partId: PartId, rest: Transform): Transform =>
  poses.get(partId) ?? rest;

import type { Joint, Part, PartId, Project, Transform } from '../types';
import {
  composeRigid,
  IDENTITY_RIGID,
  invertRigid,
  rigidFromTransform,
  rigidRotationAround,
  rigidSlide,
  rigidToTransform,
  type Rigid,
} from '../math/rigid';
import { buildDriverMap, validateJoints } from './jointValidate';

/**
 * 前進運動学。rest pose と joint の値から、各部材のワールド姿勢を求める。
 *
 *   worldRigid(moving) = worldRigid(base) * jointLocal(joint) * restOffset(joint)
 *   restOffset(joint)  = inverse(base.transform) * moving.transform
 *
 * restOffset を挟むことで「値が 0 なら rest pose に戻る」ことが保証される。
 * ここは three にも React にも依存しない純粋関数（設計書 DESIGN_V2 §7）。
 */

export interface PoseResult {
  /** 部材 ID から、その部材のワールド Transform */
  poses: Map<PartId, Transform>;
  /** 閉路や多重駆動などの理由。例外は投げない */
  problems: string[];
}

/** joint による base ローカルでの変位 */
export function jointLocalRigid(joint: Joint): Rigid {
  switch (joint.kind) {
    case 'fixed':
      return IDENTITY_RIGID;
    case 'revolute':
      return rigidRotationAround(joint.origin, joint.axis, joint.value);
    case 'prismatic':
      return rigidSlide(joint.axis, joint.value);
  }
}

export function solvePoses(project: Project): PoseResult {
  const parts = new Map<PartId, Part>(project.parts.map((p) => [p.id, p]));
  const problems = validateJoints(project.joints, project.parts);
  const broken = new Set(problems.map((p) => p.jointId));
  const healthy = project.joints.filter((j) => !broken.has(j.id));
  const drivers = buildDriverMap(healthy);

  const solved = new Map<PartId, Rigid>();
  const visiting = new Set<PartId>();

  const worldOf = (partId: PartId): Rigid => {
    const cached = solved.get(partId);
    if (cached) return cached;

    const part = parts.get(partId);
    if (!part) return IDENTITY_RIGID;

    const rest = rigidFromTransform(part.transform);
    const joint = drivers.get(partId);
    if (!joint) {
      solved.set(partId, rest);
      return rest;
    }

    // 検査を通っていれば起きないが、万一の無限再帰を止める
    if (visiting.has(partId)) {
      solved.set(partId, rest);
      return rest;
    }
    visiting.add(partId);

    const basePart = parts.get(joint.basePartId);
    if (!basePart) {
      visiting.delete(partId);
      solved.set(partId, rest);
      return rest;
    }

    const baseWorld = worldOf(joint.basePartId);
    const restOffset = composeRigid(invertRigid(rigidFromTransform(basePart.transform)), rest);
    const world = composeRigid(composeRigid(baseWorld, jointLocalRigid(joint)), restOffset);

    visiting.delete(partId);
    solved.set(partId, world);
    return world;
  };

  const poses = new Map<PartId, Transform>();
  for (const part of project.parts) {
    poses.set(part.id, rigidToTransform(worldOf(part.id)));
  }

  return { poses, problems: problems.map((p) => p.message) };
}

/** pose を適用した部材の配列。干渉判定や出力はこれを使う。 */
export function applyPoses(parts: readonly Part[], poses: Map<PartId, Transform>): Part[] {
  return parts.map((part) => {
    const pose = poses.get(part.id);
    return pose ? { ...part, transform: pose } : part;
  });
}

/** その部材が joint で動かされているか（配置モードのギズモ判定に使う） */
export function isDrivenPart(joints: readonly Joint[], partId: PartId): Joint | undefined {
  return joints.find((j) => j.enabled && j.movingPartId === partId);
}

/**
 * rest pose をギズモで編集してよいか（設計書 DESIGN_V2 §7.5）。
 * 値が 0 でない可動部材を動かすと、閉じたときにずれるため禁止する。
 */
export function canEditRestPose(joints: readonly Joint[], partId: PartId): boolean {
  const joint = isDrivenPart(joints, partId);
  if (!joint || joint.kind === 'fixed') return true;
  return Math.abs(joint.value) < 1e-9;
}

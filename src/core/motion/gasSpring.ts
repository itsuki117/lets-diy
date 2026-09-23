import { GAS_SPRING_STEPS, GRAVITY, MATERIAL_DENSITY } from '../constants';
import { applyRigid, rigidFromTransform } from '../math/rigid';
import { cross, length, sub } from '../math/vec3';
import { solvePoses } from './kinematics';
import type { GasSpringMount, Project, RevoluteJoint } from '../types';

export interface GasSpringCurvePoint {
  angleDeg: number;
  lengthMm: number;
  feasible: boolean;
  requiredN: number;
}

export function gasSpringCurve(
  mount: GasSpringMount,
  joint: RevoluteJoint,
  project: Project,
  steps = GAS_SPRING_STEPS,
): GasSpringCurvePoint[] {
  const base = project.parts.find((part) => part.id === joint.basePartId);
  const moving = project.parts.find((part) => part.id === joint.movingPartId);
  if (!base || !moving) return [];
  const massKg = moving.size.x * moving.size.y * moving.size.z * 1e-9 * MATERIAL_DENSITY[moving.material];
  const count = Math.max(1, Math.floor(steps));
  return Array.from({ length: count + 1 }, (_, index) => {
    const angleDeg = joint.range.min + ((joint.range.max - joint.range.min) * index) / count;
    const joints = project.joints.map((item) => item.id === joint.id ? { ...item, value: angleDeg } : item);
    const poses = solvePoses({ ...project, joints }).poses;
    const basePose = rigidFromTransform(poses.get(base.id) ?? base.transform);
    const movingPose = rigidFromTransform(poses.get(moving.id) ?? moving.transform);
    const a = applyRigid(basePose, mount.baseAnchor);
    const b = applyRigid(movingPose, mount.movingAnchor);
    const lengthMm = length(sub(b, a));
    const center = applyRigid(movingPose, [0, 0, 0]);
    const axisWorld = sub(applyRigid(basePose, joint.axis), applyRigid(basePose, [0, 0, 0]));
    const originWorld = applyRigid(basePose, joint.origin);
    const gravityMoment = length(cross(sub(center, originWorld), [0, -massKg * GRAVITY, 0]));
    const springArm = Math.max(1e-6, length(cross(sub(a, originWorld), sub(b, a))) / Math.max(length(sub(b, a)), 1e-6));
    return {
      angleDeg,
      lengthMm,
      feasible: lengthMm >= mount.strokeMin && lengthMm <= mount.strokeMax && length(axisWorld) > 0,
      requiredN: gravityMoment / springArm,
    };
  });
}

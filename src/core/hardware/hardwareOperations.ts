import { createOperationId } from '../ids';
import { applyMat3, rotationMatrix } from '../math/matrix';
import { applyRigid } from '../math/rigid';
import { add } from '../math/vec3';
import { isMovableJoint, type AxisDirection, type GasSpringMount, type Hardware, type Operation, type PartId, type Project, type Vec3 } from '../types';
import { latchValue } from '../motion/limits';
import { gasAnchorPairs, hardwareInstances, movingAnchorAt, movingSubtree, placeHole, restOffset } from './mechanism';

const AXES = ['x', 'y', 'z'] as const;
const toDirection = (face: { axis: 0 | 1 | 2; sign: 1 | -1 }): AxisDirection =>
  `${face.sign > 0 ? '+' : '-'}${AXES[face.axis]}` as AxisDirection;

/**
 * 金物に必要な穴を、実際にネジやカップが入る部材の加工にする（設計書 DESIGN_V2 §10.2）。
 *
 * - 丁番は数量ぶんピン方向に並べ、レールは 1 対なら反対側にも付ける
 * - ガススプリングは取付点（ブラケット）に穴をあける
 * - 穴は「相手の部材の方を向いている面」から掘る（側板なら内側、扉なら裏面）
 * - 固定側の穴は、joint の固定側に限らず、取付点に最も近い動かない部材にあける
 *
 * 戻り値は部材 ID ごとの加工。すべて note に hardwareId を持つ（J-8）。
 */
export function hardwareOperations(
  hardware: Hardware,
  project: Project,
  basePartId: PartId,
  movingPartId: PartId,
  mount?: GasSpringMount,
): Map<PartId, Operation[]> {
  const result = new Map<PartId, Operation[]>();
  const base = project.parts.find((part) => part.id === basePartId);
  const moving = project.parts.find((part) => part.id === movingPartId);
  if (!base || !moving) return result;
  const moved = movingSubtree(project, moving.id);
  const staticParts = project.parts.filter((part) => !moved.has(part.id));
  const movingParts = project.parts.filter((part) => moved.has(part.id));
  const offset = restOffset(base, moving);
  const movingCenter = offset.translation;
  const baseCenter: Vec3 = [0, 0, 0];

  const push = (target: 'base' | 'moving', pointBase: Vec3, hole: Hardware['preset']['holes'][number]): void => {
    const placement = target === 'base'
      ? placeHole(base, pointBase, staticParts, base, movingCenter)
      : placeHole(base, pointBase, movingParts, moving, baseCenter);
    // 面を選んで付けた金物は、その面から掘る
    const picked = hardware.faces && placement.partId === base.id && target === 'base'
      ? hardware.faces.base
      : hardware.faces && placement.partId === moving.id && target === 'moving'
        ? hardware.faces.moving
        : null;
    const direction = picked ?? toDirection(placement.face);
    const common = {
      id: createOperationId(), enabled: true, depth: hole.depth, through: hole.through,
      position: placement.position, direction, note: hardware.id,
    };
    const operation: Operation = hole.shape === 'round'
      ? { ...common, type: 'roundHole', diameter: hole.width }
      : { ...common, type: 'rectHole', width: hole.width, height: hole.height ?? hole.width, rotation: 0 };
    result.set(placement.partId, [...(result.get(placement.partId) ?? []), operation]);
  };

  if (hardware.preset.kind === 'gasSpring') {
    const joint = project.joints.find((item) => item.id === mount?.jointId);
    if (!mount || !joint || !isMovableJoint(joint)) return result;
    for (const pair of gasAnchorPairs(mount, hardware.quantity, joint, base, moving)) {
      for (const hole of hardware.preset.holes) {
        push(hole.target, hole.target === 'base' ? pair.base : applyRigid(offset, pair.moving), hole);
      }
    }
    return result;
  }

  // ドアロックの金物位置は「噛み合った状態」。ストライカーの穴は閉じた（可動量 0 の）位置に戻してから掘る
  const joint = project.joints.find((item) => item.id === hardware.jointId);
  const unlock = hardware.preset.kind === 'latch' && hardware.latch && joint && isMovableJoint(joint)
    ? (point: Vec3): Vec3 => movingAnchorAt(joint, point, -latchValue(project, joint, hardware.latch!.at))
    : (point: Vec3): Vec3 => point;

  for (const instance of hardwareInstances(hardware, base, moving)) {
    const rotation = rotationMatrix(instance.rotation);
    for (const hole of hardware.preset.holes) {
      const shifted: Vec3 = hardware.preset.kind === 'linearGuide' && hole.target === 'moving'
        ? [hole.offset[0] + (hardware.travelOffset ?? 0), hole.offset[1], hole.offset[2]]
        : hole.offset;
      const point = add(instance.position, applyMat3(rotation, shifted));
      push(hole.target, hole.target === 'moving' ? unlock(point) : point, hole);
    }
  }
  return result;
}

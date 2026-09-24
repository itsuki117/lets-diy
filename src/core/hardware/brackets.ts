import { isMovableJoint, type FixedJoint, type Joint, type MovableJoint, type PartId, type Project } from '../types';

/**
 * 固定金具（L 字金具など）の扱い（設計書 DESIGN_V2 §10.5）。
 *
 * 固定金具は「どちらが固定側か」を持たない、2 部材を一体にするつなぎ。
 * 動く部材（丁番・レール・リニアガイドで動かされる部材）に金具でつながった部材は、
 * どの順番・どちら向きで付けても、一緒に動く。
 *
 * そのための fixed joint は金具から毎回作り直す（手で作らない / 保存された fixed joint は捨てる）。
 */

export interface BracketSync {
  joints: Joint[];
  /** 動く部材を、固定側（動かない側）へ金具でつないでしまっている箇所 */
  conflicts: string[];
  /** そのせいで実際には動けない可動 */
  lockedJoints: Set<string>;
}

const fixedId = (partId: PartId): string => `jnt-fix-${partId}`;

export function rebuildBracketJoints(project: Project): BracketSync {
  const movable = project.joints.filter(isMovableJoint);
  const name = (id: PartId): string => project.parts.find((part) => part.id === id)?.name ?? '?';
  const edges = new Map<PartId, PartId[]>();
  const link = (a: PartId, b: PartId): void => { edges.set(a, [...(edges.get(a) ?? []), b]); };
  for (const hardware of project.hardware) {
    if (hardware.preset.kind !== 'bracket' || !hardware.parts) continue;
    link(hardware.parts.base, hardware.parts.moving);
    link(hardware.parts.moving, hardware.parts.base);
  }

  const drivenBy = new Map<PartId, MovableJoint>(movable.map((joint) => [joint.movingPartId, joint]));
  const assigned = new Set<PartId>(drivenBy.keys());
  const fixed: FixedJoint[] = [];
  const conflicts: string[] = [];
  const lockedJoints = new Set<string>();

  // 金具のつながりを、動く部材から幅優先でたどる。親が動けば子も動く（入れ子の可動にも対応）
  // 固定側: 固定側の部材と、そこから（動く部材を通らずに）金具でつながった部材
  const baseSide = (joint: MovableJoint): Set<PartId> => {
    const seen = new Set<PartId>([joint.basePartId]);
    const stack = [joint.basePartId];
    while (stack.length > 0) {
      for (const next of edges.get(stack.pop()!) ?? []) {
        if (next === joint.movingPartId || seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    return seen;
  };
  const queue: Array<{ part: PartId; forbidden: Set<PartId>; jointId: string }> = movable.map((joint) => ({ part: joint.movingPartId, forbidden: baseSide(joint), jointId: joint.id }));
  while (queue.length > 0) {
    const { part, forbidden, jointId } = queue.shift()!;
    for (const next of edges.get(part) ?? []) {
      if (forbidden.has(next)) {
        const message = `${name(part)} が金具で ${name(next)} に固定されているため、実際には動きません`;
        if (!conflicts.includes(message)) conflicts.push(message);
        lockedJoints.add(jointId);
        continue;
      }
      if (assigned.has(next)) continue;
      assigned.add(next);
      fixed.push({ id: fixedId(next), name: `${name(part)} + ${name(next)}`, enabled: true, kind: 'fixed', basePartId: part, movingPartId: next });
      queue.push({ part: next, forbidden, jointId });
    }
  }
  return { joints: [...movable, ...fixed], conflicts, lockedJoints };
}

/** 金具で固定側へつながれていて、実際には動けないか */
export const bracketLocked = (project: Project, joint: MovableJoint): boolean =>
  rebuildBracketJoints({ ...project, joints: motionJoints(project.joints) }).lockedJoints.has(joint.id);

/** from から固定金具でつながった部材（blocked を越えない）。from 自身を含む */
export function bracketGroup(project: Project, from: PartId, blocked: PartId): Set<PartId> {
  const group = new Set<PartId>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const hardware of project.hardware) {
      if (hardware.preset.kind !== 'bracket' || !hardware.parts) continue;
      const { base, moving } = hardware.parts;
      const next = base === current ? moving : moving === current ? base : null;
      if (!next || next === blocked || group.has(next)) continue;
      group.add(next);
      stack.push(next);
    }
  }
  return group;
}

/** 金具由来の fixed joint を除いた、動きを作る joint だけ */
export const motionJoints = (joints: readonly Joint[]): MovableJoint[] => joints.filter(isMovableJoint);

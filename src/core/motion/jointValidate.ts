import type { Joint, JointId, Part, PartId } from '../types';

/**
 * joint 構成の検査（設計書 DESIGN_V2 §5.3 の不変条件 J-1 / J-2 / J-3）。
 *
 * 例外は投げない。問題のある joint を列挙して返し、呼び出し側が
 * 「追加を拒否する」か「無効にして読み込む」かを決める。
 */

export interface JointProblem {
  jointId: JointId;
  message: string;
}

/** 有効な joint だけを対象に、動く側の部材から joint を引けるようにする */
export function buildDriverMap(joints: readonly Joint[]): Map<PartId, Joint> {
  const map = new Map<PartId, Joint>();
  for (const joint of joints) {
    if (!joint.enabled) continue;
    if (!map.has(joint.movingPartId)) map.set(joint.movingPartId, joint);
  }
  return map;
}

/** movingPart から basePart へたどって閉路になるか */
function findsCycle(start: Joint, drivers: Map<PartId, Joint>): boolean {
  const seen = new Set<PartId>([start.movingPartId]);
  let current = drivers.get(start.basePartId);
  while (current) {
    if (seen.has(current.movingPartId)) return true;
    seen.add(current.movingPartId);
    current = drivers.get(current.basePartId);
  }
  return false;
}

export function validateJoints(joints: readonly Joint[], parts: readonly Part[]): JointProblem[] {
  const problems: JointProblem[] = [];
  const partIds = new Set(parts.map((p) => p.id));
  const driven = new Set<PartId>();

  for (const joint of joints) {
    if (joint.basePartId === joint.movingPartId) {
      problems.push({ jointId: joint.id, message: '同じ部材どうしは結合できません' });
      continue;
    }
    if (!partIds.has(joint.basePartId) || !partIds.has(joint.movingPartId)) {
      problems.push({ jointId: joint.id, message: '結合する部材が見つかりません' });
      continue;
    }
    if (!joint.enabled) continue;
    if (driven.has(joint.movingPartId)) {
      problems.push({ jointId: joint.id, message: '1 つの部材を複数の可動で動かすことはできません' });
      continue;
    }
    driven.add(joint.movingPartId);
  }

  // 閉路は「多重駆動でない」ことを確かめてから見る。
  // 多重駆動が混ざったままだと、どの経路が本物か決まらない。
  const healthy = joints.filter((j) => !problems.some((p) => p.jointId === j.id));
  const drivers = buildDriverMap(healthy);
  for (const joint of healthy) {
    if (!joint.enabled) continue;
    if (findsCycle(joint, drivers)) {
      problems.push({ jointId: joint.id, message: '結合が輪になっています' });
    }
  }

  return problems;
}

export interface AddJointCheck {
  ok: boolean;
  reason?: string;
}

/** 新しい joint を足してよいか。コマンド側が追加前に呼ぶ。 */
export function canAddJoint(
  existing: readonly Joint[],
  candidate: Joint,
  parts: readonly Part[],
): AddJointCheck {
  const problems = validateJoints([...existing, candidate], parts);
  const mine = problems.find((p) => p.jointId === candidate.id);
  if (mine) return { ok: false, reason: mine.message };
  const before = validateJoints(existing, parts).length;
  if (problems.length > before) return { ok: false, reason: '既存の結合と矛盾します' };
  return { ok: true };
}

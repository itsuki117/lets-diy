import { canAddJoint } from '../../core/motion/jointValidate';
import { defaultJoint } from '../../core/motion/jointDefaults';
import { isMovableJoint, JOINT_KIND_LABELS } from '../../core/types';
import type { Joint, JointId, JointKind, PartId, Vec3 } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

const store = () => useProjectStore.getState();
const editor = () => useEditorStore.getState();

const clampValue = (joint: Joint, value: number): number => {
  if (!isMovableJoint(joint)) return 0;
  return Math.min(Math.max(value, joint.range.min), joint.range.max);
};

/**
 * joint を追加する。閉路や多重駆動になる場合は追加せず、理由を Toast で出す。
 * 「作らせない」のが方針で、壊れた状態を作ってから直させない（設計書 DESIGN_V2 §18.1）。
 */
export function addJoint(kind: JointKind, basePartId: PartId, movingPartId: PartId): JointId | null {
  const project = store().project;
  const base = project.parts.find((p) => p.id === basePartId);
  const moving = project.parts.find((p) => p.id === movingPartId);
  if (!base || !moving) {
    editor().pushToast('error', '結合する部材が見つかりません');
    return null;
  }

  const joint = defaultJoint(kind, base, moving);
  const check = canAddJoint(project.joints, joint, project.parts);
  if (!check.ok) {
    editor().pushToast('warning', check.reason ?? 'この結合は作れません');
    return null;
  }

  store().applyCommand(`${JOINT_KIND_LABELS[kind]}を追加`, (draft) => {
    draft.joints.push(joint);
  });
  return joint.id;
}

/** joint を消す。その joint を使っていた金物の接続も外す。 */
export function removeJoint(jointId: JointId): void {
  const joint = store().project.joints.find((j) => j.id === jointId);
  if (!joint) return;
  store().applyCommand(`${JOINT_KIND_LABELS[joint.kind]}を削除`, (draft) => {
    draft.joints = draft.joints.filter((j) => j.id !== jointId);
    draft.gasSprings = draft.gasSprings.filter((g) => g.jointId !== jointId);
    for (const hardware of draft.hardware) {
      if (hardware.jointId === jointId) hardware.jointId = null;
    }
  });
}

export function renameJoint(jointId: JointId, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  store().applyCommand('結合の名前を変更', (draft) => {
    const joint = draft.joints.find((j) => j.id === jointId);
    if (joint) joint.name = trimmed;
  });
}

export function setJointEnabled(jointId: JointId, enabled: boolean): void {
  store().applyCommand(enabled ? '結合を有効化' : '結合を無効化', (draft) => {
    const joint = draft.joints.find((j) => j.id === jointId);
    if (joint) joint.enabled = enabled;
  });
}

/** 可動範囲を変える。現在値が範囲外になったら一緒に丸める。 */
export function setJointRange(jointId: JointId, range: { min: number; max: number }): void {
  const next = range.min <= range.max ? range : { min: range.max, max: range.min };
  store().applyCommand('可動範囲を変更', (draft) => {
    const joint = draft.joints.find((j) => j.id === jointId);
    if (!joint || !isMovableJoint(joint)) return;
    joint.range = next;
    joint.value = Math.min(Math.max(joint.value, next.min), next.max);
  });
}

/** 値を確定させる（1 Undo ステップ）。スライダーのドラッグ中は使わない。 */
export function setJointValue(jointId: JointId, value: number, label = '可動量を変更'): void {
  const joint = store().project.joints.find((j) => j.id === jointId);
  if (!joint || !isMovableJoint(joint)) return;
  const next = clampValue(joint, value);
  store().applyCommand(label, (draft) => {
    const target = draft.joints.find((j) => j.id === jointId);
    if (target && isMovableJoint(target)) target.value = next;
  });
}

/** スライダーのドラッグ中に呼ぶ。履歴には積まない（Ver.1 の Transient と同じ扱い）。 */
export function updateTransientJointValue(jointId: JointId, value: number): void {
  const joint = store().project.joints.find((j) => j.id === jointId);
  if (!joint || !isMovableJoint(joint)) return;
  const next = clampValue(joint, value);
  store().updateTransient((draft) => {
    const target = draft.joints.find((j) => j.id === jointId);
    if (target && isMovableJoint(target)) target.value = next;
  });
}

/** 回転軸・移動方向を変える */
export function setJointAxis(jointId: JointId, axis: Vec3): void {
  store().applyCommand('可動の向きを変更', (draft) => {
    const joint = draft.joints.find((j) => j.id === jointId);
    if (joint && isMovableJoint(joint)) joint.axis = axis;
  });
}

/** ヒンジの回転中心を変える */
export function setJointOrigin(jointId: JointId, origin: Vec3): void {
  store().applyCommand('回転中心を変更', (draft) => {
    const joint = draft.joints.find((j) => j.id === jointId);
    if (joint && joint.kind === 'revolute') joint.origin = origin;
  });
}

/** すべての可動を閉じる（値を 0 に戻す） */
export function closeAllJoints(): void {
  store().applyCommand('すべて閉じる', (draft) => {
    for (const joint of draft.joints) {
      if (isMovableJoint(joint)) joint.value = Math.min(Math.max(0, joint.range.min), joint.range.max);
    }
  });
}

/** 選択中の可動を開閉する（O キー / ボタン） */
export function toggleSelectedJoint(): void {
  const jointId = editor().selectedJointId;
  if (!jointId) return;
  const joint = store().project.joints.find((j) => j.id === jointId);
  if (!joint || !isMovableJoint(joint) || !joint.enabled) return;
  const mid = (joint.range.min + joint.range.max) / 2;
  const target = joint.value > mid ? joint.range.min : joint.range.max;
  setJointValue(jointId, target, target === joint.range.min ? '閉じる' : '開く');
}

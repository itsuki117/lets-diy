import { motionLimits } from '../../core/motion/limits';
import { isMovableJoint } from '../../core/types';
import type { Joint, JointId } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

const store = () => useProjectStore.getState();
const editor = () => useEditorStore.getState();

/** 実際に動ける範囲。金物の範囲、ガススプリングの伸縮、ドアロックで決まる */
export const effectiveRange = (joint: Joint): { min: number; max: number } => {
  if (!isMovableJoint(joint)) return { min: 0, max: 0 };
  return motionLimits(store().project, joint);
};

const clampValue = (joint: Joint, value: number): number => {
  if (!isMovableJoint(joint)) return 0;
  const range = effectiveRange(joint);
  return Math.min(Math.max(value, range.min), range.max);
};

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

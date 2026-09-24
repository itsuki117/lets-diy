import { motionLimits } from '../../core/motion/limits';
import { isMovableJoint, type HardwareId, type Joint, type JointId } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useSimulationStore, workingProject } from '../useSimulationStore';

/**
 * 動作確認の中だけで効く操作（設計書 DESIGN_V2 §9.6）。
 * 設計データには書き込まず、履歴にも積まない。動作確認を出ると元に戻る。
 */

const sim = () => useSimulationStore.getState();

/** 実際に動ける範囲（金物の範囲・ガススプリングの伸縮・ロック） */
export function simLimits(joint: Joint): { min: number; max: number } {
  if (!isMovableJoint(joint)) return { min: 0, max: 0 };
  return motionLimits(workingProject(), joint);
}

export function simJointValue(jointId: JointId): number {
  const joint = workingProject().joints.find((item) => item.id === jointId);
  return joint && isMovableJoint(joint) ? joint.value : 0;
}

/** 可動量を変える。clamp すると、動ける範囲の外へは出ない */
export function simSetJointValue(jointId: JointId, value: number, clamp = true): void {
  const joint = workingProject().joints.find((item) => item.id === jointId);
  if (!joint || !isMovableJoint(joint)) return;
  const range = clamp ? simLimits(joint) : { min: -Infinity, max: Infinity };
  const next = Math.min(Math.max(value, range.min), range.max);
  sim().update((draft) => {
    const target = draft.joints.find((item) => item.id === jointId);
    if (target && isMovableJoint(target)) target.value = next;
  });
}

export function simSetLatch(hardwareId: HardwareId, engaged: boolean): void {
  sim().update((draft) => {
    const target = draft.hardware.find((item) => item.id === hardwareId);
    if (target?.latch) target.latch.engaged = engaged;
  });
}

export function simSetGasLock(mountId: string, locked: boolean): void {
  sim().update((draft) => {
    const mount = draft.gasSprings.find((item) => item.id === mountId);
    if (mount) mount.locked = locked;
  });
}

/** O キー: 選択中の可動を開く / 閉じる。動作確認の中でだけ効く */
export function simToggleSelectedJoint(): void {
  if (!sim().project) return;
  const jointId = useEditorStore.getState().selectedJointId;
  const joint = workingProject().joints.find((item) => item.id === jointId);
  if (!jointId || !joint || !isMovableJoint(joint) || !joint.enabled) return;
  const range = simLimits(joint);
  simSetJointValue(jointId, joint.value > (range.min + range.max) / 2 ? range.min : range.max);
}

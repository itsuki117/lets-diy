import { produce } from 'immer';
import { create } from 'zustand';
import { jointLatches, latchValue } from '../core/motion/limits';
import { isMovableJoint, type Project } from '../core/types';
import { useProjectStore } from './useProjectStore';

/**
 * 動作確認の世界（設計書 DESIGN_V2 §9.6）。
 *
 * 動作確認は作業スペースとは別の次元。入ったときに設計データを写し取り、
 * 開閉・昇降・ロックの操作はすべてこの写しの上で行う。
 * 設計データ（useProjectStore）には書き戻さず、履歴にも積まない。出たら捨てる。
 */
interface SimulationStore {
  /** 動作確認中の写し。null なら作業スペース */
  project: Project | null;
  begin: (source: Project) => void;
  end: () => void;
  update: (recipe: (draft: Project) => void) => void;
}

/** 動作確認を始めたときの状態: すべて設計どおり（可動量 0）。自動ロックは、その位置が掛かる位置なら掛かっている */
function initialState(source: Project): Project {
  const rest = produce(source, (draft) => {
    for (const joint of draft.joints) if (isMovableJoint(joint)) joint.value = 0;
    for (const mount of draft.gasSprings) mount.locked = false;
    for (const hardware of draft.hardware) if (hardware.latch) hardware.latch.engaged = false;
  });
  return produce(rest, (draft) => {
    for (const joint of rest.joints) {
      if (!isMovableJoint(joint)) continue;
      for (const latch of jointLatches(rest, joint.id)) {
        if (latch.preset.latchMode === 'manual' || !latch.latch) continue;
        if (Math.abs(latchValue(rest, joint, latch.latch.at)) < 1e-6) {
          const target = draft.hardware.find((item) => item.id === latch.id);
          if (target?.latch) target.latch.engaged = true;
        }
      }
    }
  });
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  project: null,
  begin: (source) => set({ project: initialState(source) }),
  end: () => set({ project: null }),
  update: (recipe) => {
    const current = get().project;
    if (current) set({ project: produce(current, recipe) });
  },
}));

/** 表示と動きの計算に使うプロジェクト。動作確認中は写し、作業中は設計データ */
export const workingProject = (): Project => useSimulationStore.getState().project ?? useProjectStore.getState().project;

export function useWorkingProject(): Project {
  const simulated = useSimulationStore((state) => state.project);
  const real = useProjectStore((state) => state.project);
  return simulated ?? real;
}

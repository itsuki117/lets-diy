import { useEditorStore } from './useEditorStore';
import { useMotionStore } from './useMotionStore';
import { useProjectStore } from './useProjectStore';
import { useSimulationStore } from './useSimulationStore';

/**
 * project の変化に追従して、エディタ状態から消えた部材への参照を掃除する。
 * geometry のキャッシュ同期は three に依存するので viewport 側で行う（設計書 §5.1）。
 */
export function startStoreSync(): () => void {
  // 起動時に一度だけ姿勢を解く
  useMotionStore.getState().recompute(useProjectStore.getState().project);

  // 動作確認は別の世界: 入ったときに設計データを写し、出たら捨てる（設計書 DESIGN_V2 §9.6）
  const unsubWorkspace = useEditorStore.subscribe((state, prev) => {
    if (state.workspace === prev.workspace) return;
    if (state.workspace === 'motionCheck') useSimulationStore.getState().begin(useProjectStore.getState().project);
    else useSimulationStore.getState().end();
  });
  const unsubSimulation = useSimulationStore.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    useMotionStore.getState().recompute(state.project ?? useProjectStore.getState().project);
  });

  const unsubProject = useProjectStore.subscribe((state, prev) => {
    // parts か joints が変わったときだけ解き直す。毎フレームは呼ばない。動作確認中は写しの姿勢を出す
    if ((state.project.parts !== prev.project.parts || state.project.joints !== prev.project.joints) && !useSimulationStore.getState().project) {
      useMotionStore.getState().recompute(state.project);
    }
    if (state.loadRevision !== prev.loadRevision) {
      useEditorStore.setState({ selectedIds: [], hoveredId: null, hoveredFace: null,
        faceSnap: null, operationDraft: null, hintOverride: null });
      return;
    }
    if (state.project.parts === prev.project.parts) return;
    useEditorStore.getState().reconcile(state.project.parts.map((p) => p.id));
  });
  return () => {
    unsubWorkspace();
    unsubSimulation();
    unsubProject();
  };
}

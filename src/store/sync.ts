import { useEditorStore } from './useEditorStore';
import { useProjectStore } from './useProjectStore';

/**
 * project の変化に追従して、エディタ状態から消えた部材への参照を掃除する。
 * geometry のキャッシュ同期は three に依存するので viewport 側で行う（設計書 §5.1）。
 */
export function startStoreSync(): () => void {
  return useProjectStore.subscribe((state, prev) => {
    if (state.loadRevision !== prev.loadRevision) {
      useEditorStore.setState({ selectedIds: [], hoveredId: null, hoveredFace: null,
        faceSnap: null, operationDraft: null, hintOverride: null });
      return;
    }
    if (state.project.parts === prev.project.parts) return;
    useEditorStore.getState().reconcile(state.project.parts.map((p) => p.id));
  });
}

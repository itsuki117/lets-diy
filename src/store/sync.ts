import { useEditorStore } from './useEditorStore';
import { useProjectStore } from './useProjectStore';

let started = false;

/**
 * project の変化に追従して、エディタ状態から消えた部材への参照を掃除する。
 * geometry のキャッシュ同期は three に依存するので viewport 側で行う（設計書 §5.1）。
 */
export function startStoreSync(): void {
  if (started) return;
  started = true;
  useProjectStore.subscribe((state, prev) => {
    if (state.project.parts === prev.project.parts) return;
    useEditorStore.getState().reconcile(state.project.parts.map((p) => p.id));
  });
}

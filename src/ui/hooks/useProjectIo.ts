import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createProject } from '../../core/project/createProject';
import { fromDocument, parseProjectJson, toDocument } from '../../core/project/serialize';
import { cancelAutosave, flushAutosave, scheduleAutosave, setAutosaveCallback } from '../../io/autosave';
import { clearAutosave, readAutosave } from '../../io/LocalStorageRepository';
import { downloadProjectJson } from '../../io/fileDownload';
import { openJsonFile } from '../../io/fileOpen';
import { getRepository } from '../../io/LocalStorageRepository';
import { hasUnsavedChanges, useProjectStore } from '../../store/useProjectStore';
import { useEditorStore } from '../../store/useEditorStore';

export interface ProjectIo {
  newProject: () => void;
  openFromFile: () => void;
  saveToBrowser: () => void;
  downloadFile: () => void;
}

export function useProjectIo(): ProjectIo {
  const loadProject = useProjectStore((s) => s.loadProject);
  const markSaved = useProjectStore((s) => s.markSaved);
  const pushToast = useEditorStore((s) => s.pushToast);

  const confirmDiscard = useCallback((): boolean => {
    if (!hasUnsavedChanges(useProjectStore.getState())) return true;
    return window.confirm('保存していない変更があります。破棄して続けますか？');
  }, []);

  const newProject = useCallback(() => {
    if (!confirmDiscard()) return;
    loadProject(createProject());
    useEditorStore.getState().clearSelection();
    pushToast('info', '新しいプロジェクトを作成しました');
  }, [confirmDiscard, loadProject, pushToast]);

  const openFromFile = useCallback(() => {
    if (!confirmDiscard()) return;
    void openJsonFile().then((text) => {
      if (text === null) return;
      const result = parseProjectJson(text);
      if (!result.ok) {
        pushToast('error', result.error.message);
        console.error('[io] load failed', result.error.detail);
        return;
      }
      loadProject(result.value);
      useEditorStore.getState().clearSelection();
      pushToast('success', `「${result.value.name}」を読み込みました`);
    }).catch((error: unknown) => {
      pushToast('error', error instanceof Error ? error.message : 'ファイルの読み込みに失敗しました');
    });
  }, [confirmDiscard, loadProject, pushToast]);

  const saveToBrowser = useCallback(() => {
    const project = useProjectStore.getState().project;
    const doc = toDocument(project);
    getRepository()
      .save(doc)
      .then(() => {
        markSaved(project);
        pushToast('success', 'ブラウザに保存しました');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '保存に失敗しました';
        pushToast('error', message);
        console.error('[io] save failed', error);
      });
  }, [markSaved, pushToast]);

  const downloadFile = useCallback(() => {
    const project = useProjectStore.getState().project;
    downloadProjectJson(toDocument(project));
    markSaved(project);
    pushToast('success', 'JSON ファイルを書き出しました');
  }, [markSaved, pushToast]);

  return useMemo(
    () => ({ newProject, openFromFile, saveToBrowser, downloadFile }),
    [newProject, openFromFile, saveToBrowser, downloadFile],
  );
}

/** App に一度だけ設置。ボタンから使う useProjectIo は副作用を持たない。 */
export function useProjectLifecycle(): void {
  const restored = useRef(false);

  // 起動時の復元確認。自動で上書きせず、必ずユーザーに聞く（設計書 §16.6）
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const { loadProject } = useProjectStore.getState();
    const { pushToast } = useEditorStore.getState();
    const raw = readAutosave();
    if (!raw) return;
    const result = fromDocument(raw);
    if (!result.ok || result.value.parts.length === 0) {
      clearAutosave();
      return;
    }
    if (window.confirm(`前回の続き「${result.value.name}」(部材 ${result.value.parts.length} 件) から再開しますか？`)) {
      loadProject(result.value);
      pushToast('success', '前回の続きを復元しました');
    } else {
      clearAutosave();
    }
    // 起動時に 1 回だけ実行する
  }, []);

  // 自動保存（1 秒 debounce）と、離脱時の同期保存
  useEffect(() => {
    setAutosaveCallback(
      (project) => useProjectStore.getState().markSaved(project),
      (error) => useEditorStore.getState().pushToast('error', error instanceof Error ? error.message : '自動保存に失敗しました。JSON を書き出してください'),
    );
    const unsubscribe = useProjectStore.subscribe((state, prev) => {
      if (state.loadRevision !== prev.loadRevision) {
        cancelAutosave();
        return;
      }
      if (state.transientBase) {
        cancelAutosave();
        return;
      }
      if (state.project === prev.project && !prev.transientBase) return;
      scheduleAutosave(state.project);
    });
    const onBeforeUnload = (): void => {
      const state = useProjectStore.getState();
      scheduleAutosave(state.transientBase ?? state.project);
      flushAutosave();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', onBeforeUnload);
      setAutosaveCallback(null);
      cancelAutosave();
    };
  }, []);
}

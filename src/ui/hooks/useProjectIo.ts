import { useCallback, useEffect, useMemo } from 'react';
import { createProject } from '../../core/project/createProject';
import { fromDocument, parseProjectJson, toDocument } from '../../core/project/serialize';
import { flushAutosave, scheduleAutosave, setAutosaveCallback } from '../../io/autosave';
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
    });
  }, [confirmDiscard, loadProject, pushToast]);

  const saveToBrowser = useCallback(() => {
    const doc = toDocument(useProjectStore.getState().project);
    getRepository()
      .save(doc)
      .then(() => {
        markSaved();
        pushToast('success', 'ブラウザに保存しました');
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '保存に失敗しました';
        pushToast('error', message);
        console.error('[io] save failed', error);
      });
  }, [markSaved, pushToast]);

  const downloadFile = useCallback(() => {
    downloadProjectJson(toDocument(useProjectStore.getState().project));
    markSaved();
    pushToast('success', 'JSON ファイルを書き出しました');
  }, [markSaved, pushToast]);

  // 起動時の復元確認。自動で上書きせず、必ずユーザーに聞く（設計書 §16.6）
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自動保存（1 秒 debounce）と、離脱時の同期保存
  useEffect(() => {
    setAutosaveCallback(() => useProjectStore.getState().markSaved());
    const unsubscribe = useProjectStore.subscribe((state, prev) => {
      if (state.project === prev.project) return;
      scheduleAutosave(state.project);
    });
    const onBeforeUnload = (): void => flushAutosave();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', onBeforeUnload);
      setAutosaveCallback(null);
    };
  }, []);

  return useMemo(
    () => ({ newProject, openFromFile, saveToBrowser, downloadFile }),
    [newProject, openFromFile, saveToBrowser, downloadFile],
  );
}

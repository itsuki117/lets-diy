import { useEffect } from 'react';
import { duplicateParts, removeParts } from '../../store/commands/partCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

const isTextEntry = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

/** すべてのショートカットは画面上のボタンと 1:1 対応させる（設計書 §2.4） */
export function useKeyboardShortcuts(onSave: () => void, onFocus: (ids: string[]) => void): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const editor = useEditorStore.getState();
      const project = useProjectStore.getState();

      if (event.key === 'Escape') {
        if (editor.faceSnap) editor.cancelFaceSnap();
        else if (editor.operationDraft) editor.setOperationDraft(null);
        else if (!isTextEntry(event.target)) editor.clearSelection();
        return;
      }
      if (isTextEntry(event.target)) return;

      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) project.redo();
        else project.undo();
        return;
      }
      if (ctrl && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        project.redo();
        return;
      }
      if (ctrl && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
        return;
      }
      if (ctrl && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateParts(editor.selectedIds);
        return;
      }
      if (ctrl) return;

      switch (event.key) {
        case '1':
          editor.setMode('create');
          break;
        case '2':
          editor.setMode('arrange');
          break;
        case '3':
          editor.setMode('machine');
          break;
        case 'g':
        case 'G':
          editor.setGizmoMode('translate');
          break;
        case 'r':
        case 'R':
          editor.setGizmoMode('rotate');
          break;
        case 'f':
        case 'F':
          onFocus(editor.selectedIds);
          break;
        case 'Delete':
        case 'Backspace':
          if (editor.selectedIds.length > 0) {
            event.preventDefault();
            removeParts(editor.selectedIds);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave, onFocus]);
}

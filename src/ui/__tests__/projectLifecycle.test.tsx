import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { createPart } from '../../core/part/createPart';
import { toDocument } from '../../core/project/serialize';
import { KEYS } from '../../io/LocalStorageRepository';
import { cancelAutosave } from '../../io/autosave';
import { hasUnsavedChanges, useProjectStore } from '../../store/useProjectStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectIo, useProjectLifecycle } from '../hooks/useProjectIo';

function Lifecycle() { useProjectLifecycle(); useProjectIo(); useProjectIo(); return null; }
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  useProjectStore.getState().loadProject(createProject());
  useEditorStore.setState({ toasts: [] });
});
afterEach(() => { cancelAutosave(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('project persistence lifecycle', () => {
  it('asks to restore once even in StrictMode with multiple action consumers', () => {
    const project = { ...createProject(), parts: [createPart({})] };
    localStorage.setItem(KEYS.autosave, JSON.stringify(toDocument(project)));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<StrictMode><Lifecycle /></StrictMode>);
    expect(confirm).toHaveBeenCalledOnce();
    expect(useProjectStore.getState().project).toEqual(project);
  });
  it('debounces edits and does not save intermediate dragging states', () => {
    render(<Lifecycle />);
    const state = () => useProjectStore.getState();
    act(() => {
      state().applyCommand('rename', (p) => { p.name = 'A'; });
      state().beginTransient();
      state().updateTransient((p) => { p.name = 'dragging'; });
      vi.advanceTimersByTime(1100);
    });
    expect(localStorage.getItem(KEYS.autosave)).toBeNull();
    act(() => { state().commitTransient('finish'); vi.advanceTimersByTime(1100); });
    expect(JSON.parse(localStorage.getItem(KEYS.autosave)!).project.name).toBe('dragging');
    expect(hasUnsavedChanges(state())).toBe(false);
  });
  it('cancels an old queued save when another project is opened', () => {
    render(<Lifecycle />);
    act(() => {
      useProjectStore.getState().applyCommand('rename', (p) => { p.name = 'old'; });
      useProjectStore.getState().loadProject(createProject());
      vi.advanceTimersByTime(1100);
    });
    expect(localStorage.getItem(KEYS.autosave)).toBeNull();
  });
  it('reports quota failures and leaves changes unsaved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    render(<Lifecycle />);
    act(() => {
      useProjectStore.getState().applyCommand('rename', (p) => { p.name = 'new'; });
      vi.advanceTimersByTime(1100);
    });
    expect(hasUnsavedChanges(useProjectStore.getState())).toBe(true);
    expect(useEditorStore.getState().toasts.at(-1)?.kind).toBe('error');
  });
  it('edits in the same millisecond remain dirty, and saving an old snapshot cannot mark them saved', () => {
    const state = () => useProjectStore.getState();
    const saved = state().project;
    state().applyCommand('rename', (p) => { p.name = 'changed'; });
    expect(saved.updatedAt).toBe(state().project.updatedAt);
    state().markSaved(saved);
    expect(hasUnsavedChanges(state())).toBe(true);
  });
});

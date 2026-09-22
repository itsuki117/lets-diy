import { create } from 'zustand';
import { applyPatches, produce, produceWithPatches } from 'immer';
import { HISTORY_LIMIT } from '../core/constants';
import { createProject } from '../core/project/createProject';
import type { Project } from '../core/types';
import { trimHistory, type HistoryEntry } from './history';

export interface ProjectStore {
  project: Project;
  past: HistoryEntry[];
  future: HistoryEntry[];
  transientBase: Project | null;
  /** 最後にファイル／localStorage へ保存した時点の updatedAt */
  savedAt: string | null;

  applyCommand: (label: string, recipe: (draft: Project) => void) => void;
  beginTransient: () => void;
  updateTransient: (recipe: (draft: Project) => void) => void;
  commitTransient: (label: string) => void;
  abortTransient: () => void;

  undo: () => void;
  redo: () => void;
  loadProject: (project: Project) => void;
  markSaved: () => void;
}

const touch = (draft: Project): void => {
  draft.updatedAt = new Date().toISOString();
};

const initialProject = createProject();

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: initialProject,
  past: [],
  future: [],
  transientBase: null,
  savedAt: initialProject.updatedAt,

  applyCommand(label, recipe) {
    const [next, patches, inversePatches] = produceWithPatches(get().project, (draft) => {
      recipe(draft);
      touch(draft);
    });
    // updatedAt だけの差分は「変化なし」とみなす
    if (patches.length <= 1 && patches.every((p) => p.path[0] === 'updatedAt')) return;
    set({
      project: next,
      past: trimHistory([...get().past, { label, patches, inversePatches, at: Date.now() }], HISTORY_LIMIT),
      future: [],
    });
  },

  beginTransient() {
    if (get().transientBase) return;
    set({ transientBase: get().project });
  },

  updateTransient(recipe) {
    set({ project: produce(get().project, (draft) => { recipe(draft); touch(draft); }) });
  },

  commitTransient(label) {
    const base = get().transientBase;
    if (!base) return;
    const final = get().project;
    const [next, patches, inversePatches] = produceWithPatches(base, (draft) => {
      draft.parts = final.parts as typeof draft.parts;
      draft.name = final.name;
      draft.updatedAt = final.updatedAt;
    });
    if (patches.length <= 1 && patches.every((p) => p.path[0] === 'updatedAt')) {
      set({ project: base, transientBase: null });
      return;
    }
    set({
      project: next,
      transientBase: null,
      past: trimHistory([...get().past, { label, patches, inversePatches, at: Date.now() }], HISTORY_LIMIT),
      future: [],
    });
  },

  abortTransient() {
    const base = get().transientBase;
    if (!base) return;
    set({ project: base, transientBase: null });
  },

  undo() {
    const past = get().past;
    const entry = past[past.length - 1];
    if (!entry) return;
    set({
      project: applyPatches(get().project, entry.inversePatches),
      past: past.slice(0, -1),
      future: [entry, ...get().future],
    });
  },

  redo() {
    const [entry, ...rest] = get().future;
    if (!entry) return;
    set({
      project: applyPatches(get().project, entry.patches),
      past: trimHistory([...get().past, entry], HISTORY_LIMIT),
      future: rest,
    });
  },

  loadProject(project) {
    set({ project, past: [], future: [], transientBase: null, savedAt: project.updatedAt });
  },

  markSaved() {
    set({ savedAt: get().project.updatedAt });
  },
}));

export const canUndo = (s: ProjectStore): boolean => s.past.length > 0;
export const canRedo = (s: ProjectStore): boolean => s.future.length > 0;
export const lastLabel = (s: ProjectStore): string | null => s.past[s.past.length - 1]?.label ?? null;
export const nextLabel = (s: ProjectStore): string | null => s.future[0]?.label ?? null;
export const hasUnsavedChanges = (s: ProjectStore): boolean => s.savedAt !== s.project.updatedAt;

import { AUTOSAVE_DEBOUNCE_MS } from '../core/constants';
import { toDocument } from '../core/project/serialize';
import type { Project } from '../core/types';
import { writeAutosave } from './LocalStorageRepository';

let timer: ReturnType<typeof setTimeout> | null = null;
let queued: Project | null = null;
let onSaved: ((project: Project) => void) | null = null;
let onError: ((error: unknown) => void) | null = null;

export function setAutosaveCallback(fn: ((project: Project) => void) | null, failed: ((error: unknown) => void) | null = null): void {
  onSaved = fn;
  onError = failed;
}

function flush(): void {
  if (!queued) return;
  const project = queued;
  const doc = toDocument(project);
  try {
    writeAutosave(doc);
    queued = null;
    onSaved?.(project);
  } catch (error) {
    onError?.(error);
  }
}

/** 連続した変更を 1 回の保存にまとめる */
export function scheduleAutosave(project: Project): void {
  queued = project;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, AUTOSAVE_DEBOUNCE_MS);
}

/** ページ離脱時などに、debounce を待たず即座に書き出す */
export function flushAutosave(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  flush();
}

export function cancelAutosave(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  queued = null;
}

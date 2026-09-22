import { AUTOSAVE_DEBOUNCE_MS } from '../core/constants';
import { toDocument } from '../core/project/serialize';
import type { Project } from '../core/types';
import { writeAutosave } from './LocalStorageRepository';

let timer: ReturnType<typeof setTimeout> | null = null;
let queued: Project | null = null;
let onSaved: ((at: string) => void) | null = null;

export function setAutosaveCallback(fn: ((at: string) => void) | null): void {
  onSaved = fn;
}

function flush(): void {
  if (!queued) return;
  const doc = toDocument(queued);
  queued = null;
  try {
    writeAutosave(doc);
    onSaved?.(doc.savedAt);
  } catch (error) {
    console.error('[io] autosave failed', error);
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

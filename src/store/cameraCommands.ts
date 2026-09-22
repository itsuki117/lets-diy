import type { PartId } from '../core/types';

type FocusListener = (partIds: readonly PartId[]) => void;

const listeners = new Set<FocusListener>();

/** 選択部材にカメラを寄せる。UI から viewport 側へ伝えるための最小の通り道。 */
export function focusOnParts(partIds: readonly PartId[]): void {
  for (const listener of listeners) listener(partIds);
}

export function subscribeFocus(listener: FocusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

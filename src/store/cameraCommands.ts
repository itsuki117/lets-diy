import type { PartId, Vec3 } from '../core/types';

type FocusListener = (partIds: readonly PartId[]) => void;

const listeners = new Set<FocusListener>();
let target: Vec3 = [0, 0, 0];
export const getCameraTarget = (): Vec3 => target;
export const setCameraTarget = (value: Vec3): void => { target = value; };

/** 選択部材にカメラを寄せる。UI から viewport 側へ伝えるための最小の通り道。 */
export function focusOnParts(partIds: readonly PartId[]): void {
  for (const listener of listeners) listener(partIds);
}

export function subscribeFocus(listener: FocusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

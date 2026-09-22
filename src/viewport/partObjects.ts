import type { Object3D } from 'three';
import type { PartId } from '../core/types';

/** TransformControls に渡す Object3D を引くための登録簿 */
const objects = new Map<PartId, Object3D>();
const listeners = new Set<() => void>();

export function registerPartObject(id: PartId, object: Object3D | null): void {
  if (object) objects.set(id, object);
  else objects.delete(id);
  for (const l of listeners) l();
}

export const getPartObject = (id: PartId): Object3D | undefined => objects.get(id);

export function subscribePartObjects(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ドラッグ中の部材は、ストアからの行列書き戻しを止める */
export const dragging = { partId: null as PartId | null };

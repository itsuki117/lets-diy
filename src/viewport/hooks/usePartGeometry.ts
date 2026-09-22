import { useEffect, useReducer } from 'react';
import type { BufferGeometry } from 'three';
import { geometryCache } from '../../geometry/GeometryCache';
import type { Part } from '../../core/types';

/**
 * GeometryCache と React を繋ぐ。構築中は直前のジオメトリを返し、完成したら再描画する。
 */
export function usePartGeometry(part: Part): BufferGeometry | null {
  const [, force] = useReducer((c: number) => c + 1, 0);

  useEffect(
    () =>
      geometryCache.subscribe((id) => {
        if (id === part.id) force();
      }),
    [part.id],
  );

  useEffect(() => {
    geometryCache.ensure(part);
  }, [part]);

  return geometryCache.peek(part.id);
}

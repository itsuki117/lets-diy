import { useEffect, useReducer } from 'react';
import { geometryCache } from '../geometry/GeometryCache';
import { outlineMaterial } from './materials/materialLibrary';
import type { PartId } from '../core/types';

export function SelectionOutline({ partId }: { partId: PartId }) {
  const [, force] = useReducer((c: number) => c + 1, 0);
  useEffect(
    () =>
      geometryCache.subscribe((id) => {
        if (id === partId) force();
      }),
    [partId],
  );

  const edges = geometryCache.peekEdges(partId);
  if (!edges) return null;
  return <lineSegments geometry={edges} material={outlineMaterial} renderOrder={2} />;
}

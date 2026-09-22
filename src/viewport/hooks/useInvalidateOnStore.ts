import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { geometryCache } from '../../geometry/GeometryCache';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

/**
 * frameloop="demand" の要。データが変わったときだけ 1 フレーム描画する。
 * useFrame で毎フレーム invalidate してはならない（設計書 §10.2）。
 */
export function useInvalidateOnStore(): void {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const unsubProject = useProjectStore.subscribe((state, prev) => {
      if (state.project.parts !== prev.project.parts) geometryCache.syncWith(state.project.parts);
      invalidate();
    });
    const unsubEditor = useEditorStore.subscribe(() => invalidate());
    const unsubGeometry = geometryCache.subscribe(() => invalidate());
    return () => {
      unsubProject();
      unsubEditor();
      unsubGeometry();
    };
  }, [invalidate]);
}

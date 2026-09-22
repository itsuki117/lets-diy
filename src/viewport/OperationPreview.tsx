import { useEffect, useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { degToRad } from '../core/math/angle';
import { previewSolidSpec } from '../core/operation/toolSolid';
import { createToolGeometry } from '../geometry/toolGeometry';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
import { previewMaterial } from './materials/materialLibrary';

/**
 * 加工プレビュー。CSG は一切走らせず、ツール立体をそのまま半透明で重ねる（設計書 §13.5）。
 */
export function OperationPreview() {
  const draft = useEditorStore((s) => s.operationDraft);
  const parts = useProjectStore((s) => s.project.parts);
  const part = draft ? parts.find((p) => p.id === draft.partId) : undefined;

  const geometry: BufferGeometry | null = useMemo(() => {
    if (!draft || !part) return null;
    try {
      return createToolGeometry(previewSolidSpec(draft.operation, part.size));
    } catch (error) {
      console.error('[viewport] preview build failed', error);
      return null;
    }
  }, [draft, part]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry || !part) return null;
  return (
    <mesh
      geometry={geometry}
      material={previewMaterial}
      position={[part.transform.position[0], part.transform.position[1], part.transform.position[2]]}
      rotation={[
        degToRad(part.transform.rotation[0]),
        degToRad(part.transform.rotation[1]),
        degToRad(part.transform.rotation[2]),
      ]}
      renderOrder={3}
      raycast={() => null}
    />
  );
}

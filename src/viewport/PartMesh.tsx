import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import type { Mesh } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { pickFace } from '../core/part/partFaces';
import type { Part, Vec3 } from '../core/types';
import { applyTransform } from '../geometry/transformUtils';
import { useEditorStore } from '../store/useEditorStore';
import { useMotionStore } from '../store/useMotionStore';
import { getInterferenceMaterial, getPartMaterial } from './materials/materialLibrary';
import { dragging, registerPartObject } from './partObjects';
import { usePartGeometry } from './hooks/usePartGeometry';
import { SelectionOutline } from './SelectionOutline';

function PartMeshInner({ part }: { part: Part }) {
  const ref = useRef<Mesh>(null);
  const geometry = usePartGeometry(part);
  const selected = useEditorStore((s) => s.selectedIds.includes(part.id));
  const isHovered = useEditorStore((s) => s.hoveredId === part.id);
  const faceSnapActive = useEditorStore((s) => s.faceSnap !== null);
  const interfering = useEditorStore((s) => !!s.interference?.some((pair) => pair.a === part.id || pair.b === part.id));
  // joint で動かされている部材は、rest pose ではなく計算された姿勢で描く（設計書 DESIGN_V2 §7.3）。
  // ジオメトリは変わらないので GeometryCache には一切触らない。
  const pose = useMotionStore((s) => s.poses.get(part.id)) ?? part.transform;

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || dragging.partId === part.id) return;
    applyTransform(mesh, pose);
  }, [pose, part.id, part.visible, geometry]);

  useEffect(() => {
    registerPartObject(part.id, ref.current);
    return () => registerPartObject(part.id, null);
  }, [part.id, part.visible, geometry]);

  if (!geometry || !part.visible) return null;

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const editor = useEditorStore.getState();
    const point: Vec3 = [event.point.x, event.point.y, event.point.z];
    if (editor.faceSnap) {
      editor.pickFace({ partId: part.id, face: pickFace(part, point) });
      return;
    }
    if (editor.jointDraft) {
      editor.pickJointPart(part.id);
      return;
    }
    if (event.shiftKey) editor.toggleSelect(part.id);
    else editor.select([part.id]);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!faceSnapActive) return;
    event.stopPropagation();
    const point: Vec3 = [event.point.x, event.point.y, event.point.z];
    useEditorStore.getState().setHoveredFace({ partId: part.id, face: pickFace(part, point) });
  };

  return (
    <mesh
      ref={ref}
      dispose={null}
      geometry={geometry}
      material={interfering ? getInterferenceMaterial() : getPartMaterial(part.material, isHovered)}
      castShadow
      receiveShadow
      userData={{ partId: part.id }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerOver={(event) => {
        event.stopPropagation();
        useEditorStore.getState().setHovered(part.id);
      }}
      onPointerOut={() => {
        const editor = useEditorStore.getState();
        if (editor.hoveredId === part.id) editor.setHovered(null);
        if (editor.hoveredFace?.partId === part.id) editor.setHoveredFace(null);
      }}
    >
      {selected ? <SelectionOutline partId={part.id} /> : null}
    </mesh>
  );
}

export const PartMesh = memo(PartMeshInner);

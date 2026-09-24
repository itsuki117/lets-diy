import { useMemo } from 'react';
import { Matrix4, PlaneGeometry, Vector3 } from 'three';
import { worldFace } from '../core/part/partFaces';
import type { FaceRef, Part } from '../core/types';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
import { faceHighlightMaterial, faceSelectedMaterial } from './materials/materialLibrary';

const PLANE = new PlaneGeometry(1, 1);

function FaceQuad({ part, faceRef, selected }: { part: Part; faceRef: FaceRef; selected: boolean }) {
  const matrix = useMemo(() => {
    const face = worldFace(part, faceRef.face);
    const u = new Vector3(...face.u).multiplyScalar(face.halfU * 2);
    const v = new Vector3(...face.v).multiplyScalar(face.halfV * 2);
    const n = new Vector3(...face.normal);
    const center = new Vector3(...face.center).addScaledVector(n, 0.4);
    const m = new Matrix4().makeBasis(u, v, n);
    m.setPosition(center);
    return m;
  }, [part, faceRef.face]);

  return (
    <mesh
      geometry={PLANE}
      material={selected ? faceSelectedMaterial : faceHighlightMaterial}
      matrixAutoUpdate={false}
      matrix={matrix}
      renderOrder={4}
      raycast={() => null}
    />
  );
}

/** 面スナップ中・金物の面選び中に、選択済みの面とホバー中の面を光らせる */
export function FacePickOverlay() {
  const session = useEditorStore((s) => s.faceSnap);
  const placement = useEditorStore((s) => s.placement);
  const hoveredFace = useEditorStore((s) => s.hoveredFace);
  const parts = useProjectStore((s) => s.project.parts);

  const refs: Array<{ faceRef: FaceRef; selected: boolean }> = [];
  if (session) {
    if (session.source) refs.push({ faceRef: session.source, selected: true });
    if (session.target) refs.push({ faceRef: session.target, selected: true });
  } else if (placement.step) {
    if (placement.base) refs.push({ faceRef: placement.base, selected: true });
    if (placement.moving) refs.push({ faceRef: placement.moving, selected: true });
  }
  if (!session && !placement.step) return null;
  if (hoveredFace && !refs.some((r) => r.faceRef.partId === hoveredFace.partId && r.faceRef.face === hoveredFace.face)) {
    refs.push({ faceRef: hoveredFace, selected: false });
  }

  return (
    <>
      {refs.map(({ faceRef, selected }) => {
        const part = parts.find((p) => p.id === faceRef.partId);
        if (!part) return null;
        return <FaceQuad key={`${faceRef.partId}:${faceRef.face}`} part={part} faceRef={faceRef} selected={selected} />;
      })}
    </>
  );
}

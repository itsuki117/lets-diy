import { useLayoutEffect, useRef, useState } from 'react';
import type { Object3D } from 'three';
import { TransformControls } from '@react-three/drei/core/TransformControls';
import { degToRad } from '../core/math/angle';
import { applyDraftPosition, draftHandlePosition, draggableAxes } from '../core/operation/operationDrag';
import { snapVec3 } from '../core/snap/gridSnap';
import type { Vec3 } from '../core/types';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';

/**
 * 加工位置をドラッグで動かすギズモ。
 *
 * ハンドルは部材と同じ姿勢を持つ group の子にしてあるので、
 * 部材が回転していても矢印は「板の縦・横」方向に出る。
 * 動かせる軸は加工の種類ごとに絞る（設計書 §13.4 の補助操作）。
 */
export function OperationGizmo() {
  const draft = useEditorStore((s) => s.operationDraft);
  const snap = useEditorStore((s) => s.snap);
  const updateDraft = useEditorStore((s) => s.updateOperationDraft);
  const parts = useProjectStore((s) => s.project.parts);
  const part = draft ? parts.find((p) => p.id === draft.partId) : undefined;

  const [handle, setHandle] = useState<Object3D | null>(null);
  const dragging = useRef(false);

  // draft の位置をハンドルへ反映する。ドラッグ中は書き戻さない（ちらつき防止）
  useLayoutEffect(() => {
    if (!handle || !draft || !part || dragging.current) return;
    const p = draftHandlePosition(draft.operation, part.size);
    handle.position.set(p[0], p[1], p[2]);
  }, [handle, draft, part]);

  if (!draft || !part || part.locked) return null;

  const axes = draggableAxes(draft.operation);

  const handleChange = (): void => {
    if (!handle) return;
    const local: Vec3 = [handle.position.x, handle.position.y, handle.position.z];
    const snapped = snap.grid > 0 ? snapVec3(local, snap.grid) : local;
    updateDraft((d) => ({ ...d, operation: applyDraftPosition(d.operation, snapped, part.size) }));
  };

  return (
    <>
      <group
        position={[part.transform.position[0], part.transform.position[1], part.transform.position[2]]}
        rotation={[
          degToRad(part.transform.rotation[0]),
          degToRad(part.transform.rotation[1]),
          degToRad(part.transform.rotation[2]),
        ]}
      >
        <object3D ref={setHandle} />
      </group>
      {handle ? (
        <TransformControls
          object={handle}
          mode="translate"
          space="local"
          size={0.6}
          showX={axes.x}
          showY={axes.y}
          showZ={axes.z}
          translationSnap={snap.grid > 0 ? snap.grid : null}
          onMouseDown={() => {
            dragging.current = true;
          }}
          onMouseUp={() => {
            dragging.current = false;
            handleChange();
          }}
          onObjectChange={handleChange}
        />
      ) : null}
    </>
  );
}

import { useEffect, useSyncExternalStore } from 'react';
import { TransformControls } from '@react-three/drei/core/TransformControls';
import { degToRad } from '../core/math/angle';
import { readTransform } from '../geometry/transformUtils';
import { snapVec3 } from '../core/snap/gridSnap';
import { snapAngle } from '../core/math/angle';
import { updateTransientTransform } from '../store/commands/transformCommands';
import { canEditRestPose } from '../core/motion/kinematics';
import { hardwareConnectedGroup } from '../core/hardware/brackets';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
import { dragging, getPartObject, subscribePartObjects } from './partObjects';
import type { Vec3 } from '../core/types';

export function TransformGizmo() {
  const mode = useEditorStore((s) => s.mode);
  const workspace = useEditorStore((s) => s.workspace);
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const snap = useEditorStore((s) => s.snap);
  const faceSnapActive = useEditorStore((s) => s.faceSnap !== null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const parts = useProjectStore((s) => s.project.parts);
  const joints = useProjectStore((s) => s.project.joints);

  const partId = selectedIds.length === 1 ? selectedIds[0] : undefined;
  const part = partId ? parts.find((p) => p.id === partId) : undefined;

  const object = useSyncExternalStore(
    subscribePartObjects,
    () => (partId ? getPartObject(partId) : undefined),
    () => undefined,
  );

  // 開いたままの可動部材は rest pose を編集させない（設計書 DESIGN_V2 §7.5）。
  // 45 度開けた状態で動かすと、閉じたときにずれてしまう。
  const editable = !!partId && canEditRestPose(joints, partId);
  const connected = partId ? hardwareConnectedGroup(useProjectStore.getState().project, partId) : new Set<string>();
  const connectedLocked = parts.some((candidate) => connected.has(candidate.id) && candidate.locked);
  const active =
    workspace === 'edit' && mode === 'arrange' && !faceSnapActive && !!part && !connectedLocked && part.visible && !!object && editable;
  useEffect(() => () => {
    if (dragging.partId !== null) {
      dragging.partId = null;
      useProjectStore.getState().abortTransient();
    }
  }, [partId, active, gizmoMode]);
  if (!active || !part || !object || !partId) return null;

  return (
    <TransformControls
      object={object}
      mode={gizmoMode}
      space="world"
      size={0.8}
      translationSnap={snap.grid > 0 ? snap.grid : null}
      rotationSnap={snap.angle > 0 ? degToRad(snap.angle) : null}
      onMouseDown={() => {
        dragging.partId = partId;
        useProjectStore.getState().beginTransient();
      }}
      onMouseUp={() => {
        if (dragging.partId !== partId) return;
        dragging.partId = null;
        const next = readTransform(object);
        // ドラッグ結果にもスナップを効かせてから 1 履歴として確定する
        const position: Vec3 = gizmoMode === 'translate' ? snapVec3(next.position, snap.grid) : next.position;
        const rotation: Vec3 = gizmoMode === 'rotate' ? [
          snapAngle(next.rotation[0], snap.angle),
          snapAngle(next.rotation[1], snap.angle),
          snapAngle(next.rotation[2], snap.angle),
        ] : next.rotation;
        updateTransientTransform(partId, { position, rotation });
        useProjectStore.getState().commitTransient(gizmoMode === 'translate' ? '部材を移動' : '部材を回転');
      }}
      onObjectChange={() => {
        if (dragging.partId !== partId) return;
        updateTransientTransform(partId, readTransform(object));
      }}
    />
  );
}

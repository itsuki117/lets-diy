import { AppError } from '../../core/result';
import { snapAngle } from '../../core/math/angle';
import { snapVec3 } from '../../core/snap/gridSnap';
import { computeAlignedPositions } from '../../core/snap/align';
import { computeFaceSnapTransform } from '../../core/snap/faceSnap';
import type { AlignAnchor, AxisKey, FaceRef, PartId, Transform, Vec3 } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

const store = () => useProjectStore.getState();
const editor = () => useEditorStore.getState();

export function setPartPosition(id: PartId, position: Vec3, label = '位置を変更'): void {
  const snapped = snapVec3(position, editor().snap.grid);
  store().applyCommand(label, (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part && !part.locked) part.transform.position = snapped;
  });
}

export function setPartRotation(id: PartId, rotation: Vec3, label = '回転を変更'): void {
  const step = editor().snap.angle;
  const snapped: Vec3 = [snapAngle(rotation[0], step), snapAngle(rotation[1], step), snapAngle(rotation[2], step)];
  store().applyCommand(label, (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part && !part.locked) part.transform.rotation = snapped;
  });
}

/** ギズモのドラッグ中に呼ぶ。履歴には積まない。 */
export function updateTransientTransform(id: PartId, transform: Transform): void {
  store().updateTransient((draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part && !part.locked) part.transform = transform;
  });
}

export function alignParts(ids: readonly PartId[], axis: AxisKey, anchor: AlignAnchor): void {
  const parts = store().project.parts.filter((p) => ids.includes(p.id));
  if (parts.length < 2) {
    editor().pushToast('warning', '整列するには 2 つ以上の部材を選択してください');
    return;
  }
  const moves = computeAlignedPositions(parts, axis, anchor);
  if (moves.size === 0) return;
  store().applyCommand('整列', (draft) => {
    for (const part of draft.parts) {
      const next = moves.get(part.id);
      if (next && !part.locked) part.transform.position = next;
    }
  });
}

export function applyFaceSnap(source: FaceRef, target: FaceRef, gap: number, centerAlign: boolean): boolean {
  const parts = store().project.parts;
  const sourcePart = parts.find((p) => p.id === source.partId);
  const targetPart = parts.find((p) => p.id === target.partId);
  if (!sourcePart || !targetPart) {
    editor().pushToast('error', '対象の部材が見つかりません');
    return false;
  }
  if (sourcePart.locked) {
    editor().pushToast('warning', 'ロックされた部材は動かせません');
    return false;
  }
  try {
    const transform = computeFaceSnapTransform({
      source: sourcePart,
      sourceFace: source.face,
      target: targetPart,
      targetFace: target.face,
      gap,
      centerAlign,
    });
    store().applyCommand('面スナップ', (draft) => {
      const part = draft.parts.find((p) => p.id === source.partId);
      if (part) part.transform = transform;
    });
    return true;
  } catch (error) {
    const message = error instanceof AppError ? error.message : '面スナップに失敗しました';
    editor().pushToast('error', message);
    console.error('[snap] face snap failed', { source, target }, error);
    return false;
  }
}

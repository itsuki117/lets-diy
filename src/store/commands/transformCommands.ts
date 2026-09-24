import { AppError } from '../../core/result';
import { snapAngle } from '../../core/math/angle';
import { snapVec3 } from '../../core/snap/gridSnap';
import { computeAlignedPositions } from '../../core/snap/align';
import { computeFaceSnapTransform } from '../../core/snap/faceSnap';
import { hardwareConnectedGroup } from '../../core/hardware/brackets';
import { composeRigid, invertRigid, rigidFromTransform, rigidToTransform } from '../../core/math/rigid';
import type { AlignAnchor, AxisKey, FaceRef, PartId, Project, Transform, Vec3 } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

const store = () => useProjectStore.getState();
const editor = () => useEditorStore.getState();

/** 選んだ部材の変換差分を、金物でつながった組立品全体へ適用する。 */
function transformConnectedParts(project: Project, id: PartId, target: Transform): void {
  const source = project.parts.find((part) => part.id === id);
  if (!source) return;
  const group = hardwareConnectedGroup(project, id);
  const delta = composeRigid(rigidFromTransform(target), invertRigid(rigidFromTransform(source.transform)));
  for (const part of project.parts) {
    if (group.has(part.id)) part.transform = rigidToTransform(composeRigid(delta, rigidFromTransform(part.transform)));
  }
  // 行列から Euler 角へ戻す際の丸め誤差を、操作対象そのものには残さない。
  const selected = project.parts.find((part) => part.id === id);
  if (selected) selected.transform = target;
}

function movableConnectedGroup(id: PartId): Set<PartId> | null {
  const project = store().project;
  const group = hardwareConnectedGroup(project, id);
  if (project.parts.some((part) => group.has(part.id) && part.locked)) {
    editor().pushToast('warning', '金物でつながった部材にロックがあるため、組立品を移動できません');
    return null;
  }
  return group;
}

export function setPartPosition(id: PartId, position: Vec3, label = '位置を変更'): void {
  const snapped = snapVec3(position, editor().snap.grid);
  if (!movableConnectedGroup(id)) return;
  store().applyCommand(label, (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part) transformConnectedParts(draft, id, { ...part.transform, position: snapped });
  });
}

export function setPartRotation(id: PartId, rotation: Vec3, label = '回転を変更'): void {
  const step = editor().snap.angle;
  const snapped: Vec3 = [snapAngle(rotation[0], step), snapAngle(rotation[1], step), snapAngle(rotation[2], step)];
  if (!movableConnectedGroup(id)) return;
  store().applyCommand(label, (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part) transformConnectedParts(draft, id, { ...part.transform, rotation: snapped });
  });
}

/** ギズモのドラッグ中に呼ぶ。履歴には積まない。 */
export function updateTransientTransform(id: PartId, transform: Transform): void {
  const project = store().project;
  const group = hardwareConnectedGroup(project, id);
  if (project.parts.some((part) => group.has(part.id) && part.locked)) return;
  store().updateTransient((draft) => {
    transformConnectedParts(draft, id, transform);
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
  if (!movableConnectedGroup(source.partId)) {
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
      transformConnectedParts(draft, source.partId, transform);
    });
    return true;
  } catch (error) {
    const message = error instanceof AppError ? error.message : '面スナップに失敗しました';
    editor().pushToast('error', message);
    console.error('[snap] face snap failed', { source, target }, error);
    return false;
  }
}

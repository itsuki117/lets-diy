import { motionJoints, rebuildBracketJoints } from '../../core/hardware/brackets';
import { MAX_SIZE_MM, MIN_SIZE_MM } from '../../core/constants';
import { copyName, createPart, type CreatePartInput } from '../../core/part/createPart';
import { createOperationId, createPartId } from '../../core/ids';
import type { MaterialKind, Part, PartId, Size3 } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

const store = () => useProjectStore.getState();
const editor = () => useEditorStore.getState();

export const clampSize = (size: Size3): Size3 => ({
  x: Math.min(MAX_SIZE_MM, Math.max(MIN_SIZE_MM, size.x)),
  y: Math.min(MAX_SIZE_MM, Math.max(MIN_SIZE_MM, size.y)),
  z: Math.min(MAX_SIZE_MM, Math.max(MIN_SIZE_MM, size.z)),
});

export function addPart(input: CreatePartInput): PartId {
  const part = createPart({ ...input, size: input.size ? clampSize(input.size) : undefined });
  store().applyCommand('木材を生成', (draft) => {
    draft.parts.push(part);
  });
  editor().select([part.id]);
  return part.id;
}

export function duplicateParts(ids: readonly PartId[]): PartId[] {
  const parts = store().project.parts;
  const targets = parts.filter((p) => ids.includes(p.id));
  if (targets.length === 0) return [];

  const names = parts.map((p) => p.name);
  const copies: Part[] = targets.map((p) => {
    const name = copyName(p.name, names);
    names.push(name);
    return {
      ...p,
      id: createPartId(),
      name,
      size: { ...p.size },
      transform: {
        position: [p.transform.position[0] + p.size.x + 20, p.transform.position[1], p.transform.position[2]],
        rotation: [...p.transform.rotation] as Part['transform']['rotation'],
      },
      operations: p.operations.map((op) => ({ ...op, id: createOperationId() })),
      createdAt: new Date().toISOString(),
    };
  });

  store().applyCommand(copies.length > 1 ? '部材を複製' : `${targets[0]?.name ?? '部材'}を複製`, (draft) => {
    draft.parts.push(...copies);
  });
  editor().select(copies.map((c) => c.id));
  return copies.map((c) => c.id);
}

export function removeParts(ids: readonly PartId[]): void {
  const parts = store().project.parts;
  const targets = parts.filter((p) => ids.includes(p.id));
  const locked = targets.filter((p) => p.locked);
  const removable = targets.filter((p) => !p.locked).map((p) => p.id);

  if (locked.length > 0) {
    editor().pushToast('warning', `ロックされた部材 ${locked.length} 件は削除しませんでした`);
  }
  if (removable.length === 0) return;

  store().applyCommand('部材を削除', (draft) => {
    draft.parts = draft.parts.filter((p) => !removable.includes(p.id));

    // 可動と金物を道連れにする。別コマンドにすると Undo が 2 回必要になり、
    // 「消したのに結合だけ残る」中途半端な状態も作れてしまう（設計書 DESIGN_V2 §18.1）。
    const orphaned = draft.joints.filter(
      (j) => removable.includes(j.basePartId) || removable.includes(j.movingPartId),
    );
    const orphanedIds = new Set(orphaned.map((j) => j.id));
    draft.joints = draft.joints.filter((j) => !orphanedIds.has(j.id));
    draft.gasSprings = draft.gasSprings.filter((g) => !orphanedIds.has(g.jointId));

    const deadHardware = draft.hardware.filter((h) => (h.jointId !== null && orphanedIds.has(h.jointId))
      || (h.parts !== undefined && (removable.includes(h.parts.base) || removable.includes(h.parts.moving))));
    const deadHardwareIds = new Set(deadHardware.map((h) => h.id));
    draft.hardware = draft.hardware.filter((h) => !deadHardwareIds.has(h.id));
    draft.gasSprings = draft.gasSprings.filter((g) => !deadHardwareIds.has(g.hardwareId));

    // 固定金具でつながった部材が一緒に動くための joint を作り直す
    draft.joints = rebuildBracketJoints({ ...draft, joints: motionJoints(draft.joints) }).joints;

    // 金物が自動生成した加工も一緒に消す（不変条件 J-8）
    for (const part of draft.parts) {
      part.operations = part.operations.filter((op) => !op.note || !deadHardwareIds.has(op.note));
    }
  });
}

export function renamePart(id: PartId, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  store().applyCommand('名前を変更', (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part) part.name = trimmed;
  });
}

export function setPartSize(id: PartId, size: Size3): void {
  const next = clampSize(size);
  store().applyCommand('寸法を変更', (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part && !part.locked) part.size = next;
  });
}

export function setPartMaterial(id: PartId, material: MaterialKind): void {
  store().applyCommand('材質を変更', (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part) part.material = material;
  });
}

export function setPartVisible(id: PartId, visible: boolean): void {
  store().applyCommand(visible ? '部材を表示' : '部材を非表示', (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part) part.visible = visible;
  });
}

export function setPartLocked(id: PartId, locked: boolean): void {
  store().applyCommand(locked ? '部材をロック' : 'ロックを解除', (draft) => {
    const part = draft.parts.find((p) => p.id === id);
    if (part) part.locked = locked;
  });
}

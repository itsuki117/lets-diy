import { createOperationId } from '../../core/ids';
import { operationLabel } from '../../core/operation/operationLabel';
import { validateOperation } from '../../core/operation/operationValidate';
import { OPERATION_TYPE_LABELS } from '../../core/operation/operationDefaults';
import type { Operation, OperationId, PartId } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

const store = () => useProjectStore.getState();
const editor = () => useEditorStore.getState();

function guard(partId: PartId, op: Operation): boolean {
  const part = store().project.parts.find((p) => p.id === partId);
  const result = validateOperation(op, part);
  if (result.errors.length > 0) {
    editor().pushToast('error', result.errors[0]?.message ?? '加工のパラメータが不正です');
    return false;
  }
  return true;
}

export function addOperation(partId: PartId, op: Operation): boolean {
  if (!guard(partId, op)) return false;
  const operation: Operation = { ...op, id: createOperationId() };
  store().applyCommand(`${OPERATION_TYPE_LABELS[op.type]}を追加`, (draft) => {
    const part = draft.parts.find((p) => p.id === partId);
    if (part) part.operations.push(operation);
  });
  return true;
}

export function updateOperation(partId: PartId, op: Operation): boolean {
  if (!guard(partId, op)) return false;
  store().applyCommand(`${OPERATION_TYPE_LABELS[op.type]}を更新`, (draft) => {
    const part = draft.parts.find((p) => p.id === partId);
    if (!part) return;
    const index = part.operations.findIndex((o) => o.id === op.id);
    if (index >= 0) part.operations[index] = op;
  });
  return true;
}

export function removeOperation(partId: PartId, operationId: OperationId): void {
  const part = store().project.parts.find((p) => p.id === partId);
  const op = part?.operations.find((o) => o.id === operationId);
  const label = part && op ? operationLabel(op, part) : '加工';
  store().applyCommand(`${label} を削除`, (draft) => {
    const target = draft.parts.find((p) => p.id === partId);
    if (target) target.operations = target.operations.filter((o) => o.id !== operationId);
  });
}

export function setOperationEnabled(partId: PartId, operationId: OperationId, enabled: boolean): void {
  store().applyCommand(enabled ? '加工を有効化' : '加工を無効化', (draft) => {
    const part = draft.parts.find((p) => p.id === partId);
    const op = part?.operations.find((o) => o.id === operationId);
    if (op) op.enabled = enabled;
  });
}

export function reorderOperation(partId: PartId, operationId: OperationId, delta: number): void {
  store().applyCommand('加工の順序を変更', (draft) => {
    const part = draft.parts.find((p) => p.id === partId);
    if (!part) return;
    const from = part.operations.findIndex((o) => o.id === operationId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= part.operations.length) return;
    const [moved] = part.operations.splice(from, 1);
    if (moved) part.operations.splice(to, 0, moved);
  });
}

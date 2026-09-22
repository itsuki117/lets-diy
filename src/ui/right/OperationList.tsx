import { ChevronDown, ChevronUp, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { operationLabel } from '../../core/operation/operationLabel';
import type { Part } from '../../core/types';
import {
  removeOperation,
  reorderOperation,
  setOperationEnabled,
} from '../../store/commands/operationCommands';
import { useEditorStore } from '../../store/useEditorStore';

export function OperationList({ part, failedIds = [] }: { part: Part; failedIds?: string[] }) {
  const setDraft = useEditorStore((s) => s.setOperationDraft);
  const setMode = useEditorStore((s) => s.setMode);

  return (
    <div className="field-group">
      <span className="field-label">
        この部材の加工 ({part.operations.length})
      </span>
      {part.operations.length === 0 ? (
        <p className="muted">まだ加工はありません</p>
      ) : (
        <ul className="op-list">
          {part.operations.map((op, index) => (
            <li key={op.id} className={`op-row${op.enabled ? '' : ' op-row-disabled'}`}>
              <label className="op-toggle">
                <input
                  type="checkbox"
                  checked={op.enabled}
                  aria-label="この加工を有効にする"
                  onChange={(event) => setOperationEnabled(part.id, op.id, event.target.checked)}
                />
              </label>
              <span className="op-label">
                {operationLabel(op, part)}
                {failedIds.includes(op.id) ? (
                  <span className="op-failed">
                    <TriangleAlert size={12} aria-hidden />
                    適用できませんでした
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="icon-btn"
                title="上へ"
                aria-label="上へ"
                disabled={index === 0}
                onClick={() => reorderOperation(part.id, op.id, -1)}
              >
                <ChevronUp size={13} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="下へ"
                aria-label="下へ"
                disabled={index === part.operations.length - 1}
                onClick={() => reorderOperation(part.id, op.id, 1)}
              >
                <ChevronDown size={13} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="編集"
                aria-label="編集"
                onClick={() => {
                  setMode('machine');
                  setDraft({ partId: part.id, editingId: op.id, operation: op, originMode: 'corner' });
                }}
              >
                <Pencil size={13} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="削除"
                aria-label="削除"
                onClick={() => removeOperation(part.id, op.id)}
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

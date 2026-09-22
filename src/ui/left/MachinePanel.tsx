import { Circle, Drill, Play, Scissors, Square, SquareDashedBottom, X } from 'lucide-react';
import { defaultOperation, OPERATION_TYPE_LABELS } from '../../core/operation/operationDefaults';
import { validateOperation } from '../../core/operation/operationValidate';
import type { OperationType } from '../../core/types';
import { addOperation, updateOperation } from '../../store/commands/operationCommands';
import { useSelectedPart } from '../../store/selectors';
import { useEditorStore } from '../../store/useEditorStore';
import { OperationForm } from './OperationForm';
import { OperationList } from '../right/OperationList';

const TYPES: Array<{ type: OperationType; Icon: typeof Circle }> = [
  { type: 'roundHole', Icon: Circle },
  { type: 'rectHole', Icon: Square },
  { type: 'notch', Icon: SquareDashedBottom },
  { type: 'cut', Icon: Scissors },
];

export function MachinePanel() {
  const part = useSelectedPart();
  const draft = useEditorStore((s) => s.operationDraft);
  const setDraft = useEditorStore((s) => s.setOperationDraft);

  if (!part) {
    return (
      <div className="panel-content">
        <p className="eyebrow">MACHINING</p>
        <h2>加工する</h2>
        <p className="muted">加工する部材を 1 つ選んでください。3D 上でクリックするか、下の一覧から選べます。</p>
      </div>
    );
  }

  const active = draft && draft.partId === part.id ? draft : null;
  const validation = active ? validateOperation(active.operation, part) : null;
  const canRun = !!validation && validation.errors.length === 0;

  const run = (): void => {
    if (!active) return;
    const ok = active.editingId ? updateOperation(part.id, active.operation) : addOperation(part.id, active.operation);
    if (ok) setDraft(null);
  };

  return (
    <div className="panel-content">
      <p className="eyebrow">MACHINING</p>
      <h2>加工する</h2>
      <p className="muted">対象: {part.name}</p>

      <div className="field-group">
        <span className="field-label">加工を追加</span>
        <div className="preset-grid">
          {TYPES.map(({ type, Icon }) => (
            <button
              key={type}
              type="button"
              className={active?.operation.type === type && !active.editingId ? 'preset-btn active' : 'preset-btn'}
              onClick={() =>
                setDraft({
                  partId: part.id,
                  editingId: null,
                  operation: defaultOperation(type, part),
                  originMode: 'corner',
                })
              }
            >
              <Icon size={15} aria-hidden />
              {OPERATION_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div className="tool-block tool-block-active">
          <span className="field-label">
            {active.editingId ? `${OPERATION_TYPE_LABELS[active.operation.type]}を編集` : `${OPERATION_TYPE_LABELS[active.operation.type]}の設定`}
          </span>
          <OperationForm part={part} draft={active} />
          <p className="muted">
            <Drill size={13} aria-hidden /> 半透明の赤い部分が削り取られます
          </p>
          <div className="button-row">
            <button type="button" className="btn-primary" disabled={!canRun} onClick={run}>
              <Play size={15} aria-hidden />
              {active.editingId ? '更新' : '加工を実行'}
            </button>
            <button type="button" onClick={() => setDraft(null)} title="キャンセル (Esc)">
              <X size={15} aria-hidden />
              キャンセル
            </button>
          </div>
        </div>
      ) : null}

      <OperationList part={part} />
    </div>
  );
}

import { Minus, Plus } from 'lucide-react';
import { AXIS_LABELS, axisValue, withAxis } from '../../core/math/axis';
import { applyDraftPosition, draftHandlePosition, draggableAxes } from '../../core/operation/operationDrag';
import type { AxisKey, OperationDraft, Part } from '../../core/types';
import { useEditorStore } from '../../store/useEditorStore';
import { SegmentedControl } from '../common/SegmentedControl';

const STEPS = [
  { value: 0.5, label: '0.5' },
  { value: 1, label: '1' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
] as const;

/**
 * 加工位置の微調整ボタン。
 *
 * ドラッグ・座標入力と並ぶ 3 つ目の位置指定手段（設計書 §13.4.1）。
 * ドラッグと同じ `applyDraftPosition` を通すので、どの方法で動かしても結果は一致する。
 * ドラッグはグリッドに吸着するが、こちらは 0.5mm 刻みまで刻めるのが役割の違い。
 */
export function OperationNudge({ part, draft }: { part: Part; draft: OperationDraft }) {
  const step = useEditorStore((s) => s.nudgeStep);
  const setStep = useEditorStore((s) => s.setNudgeStep);
  const updateDraft = useEditorStore((s) => s.updateOperationDraft);

  const axes = draggableAxes(draft.operation);
  const movable = (['x', 'y', 'z'] as const).filter((axis) => axes[axis]);
  if (movable.length === 0) return null;

  const nudge = (axis: AxisKey, direction: 1 | -1): void => {
    updateDraft((d) => {
      const handle = draftHandlePosition(d.operation, part.size);
      const moved = withAxis(handle, axis, axisValue(handle, axis) + direction * step);
      return { ...d, operation: applyDraftPosition(d.operation, moved, part.size) };
    });
  };

  return (
    <div className="field-group">
      <SegmentedControl
        label="微調整のきざみ (mm)"
        value={step}
        options={STEPS}
        onChange={(next) => setStep(next)}
      />
      <div className="nudge-grid">
        {movable.map((axis) => (
          <div key={axis} className="nudge-row">
            <span className="nudge-axis">{AXIS_LABELS[axis]}</span>
            <button
              type="button"
              className="icon-btn"
              title={`${AXIS_LABELS[axis]} を ${step}mm 減らす`}
              aria-label={`${AXIS_LABELS[axis]} を ${step}ミリ減らす`}
              onClick={() => nudge(axis, -1)}
            >
              <Minus size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={`${AXIS_LABELS[axis]} を ${step}mm 増やす`}
              aria-label={`${AXIS_LABELS[axis]} を ${step}ミリ増やす`}
              onClick={() => nudge(axis, 1)}
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

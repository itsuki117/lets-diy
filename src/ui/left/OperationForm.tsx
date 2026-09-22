import { AXIS_LABELS, ALL_DIRECTIONS, DIRECTION_LABELS, axisOf, axisSize, axisValue, otherAxes, withAxis } from '../../core/math/axis';
import { validateOperation } from '../../core/operation/operationValidate';
import { cornerToLocal, localToCorner } from '../../core/part/localFrame';
import type { ReactElement } from 'react';
import type { AxisDirection, AxisKey, Operation, OperationDraft, Part, Vec3 } from '../../core/types';
import { useEditorStore } from '../../store/useEditorStore';
import { NumberField } from '../common/NumberField';
import { SegmentedControl } from '../common/SegmentedControl';

interface Props {
  part: Part;
  draft: OperationDraft;
}

const messageFor = (issues: Array<{ field?: string; message: string }>, field: string): string | undefined =>
  issues.find((i) => i.field === field)?.message;

export function OperationForm({ part, draft }: Props) {
  const update = useEditorStore((s) => s.updateOperationDraft);
  const op = draft.operation;
  const result = validateOperation(op, part);

  const patch = (changes: Partial<Operation>): void => {
    update((d) => ({ ...d, operation: { ...d.operation, ...changes } as Operation }));
  };

  const setOriginMode = (originMode: 'center' | 'corner'): void => update((d) => ({ ...d, originMode }));

  /** UI は既定でコーナー原点。保存は常に中心原点（設計書 §4.5）。 */
  const displayPosition = (position: Vec3): Vec3 =>
    draft.originMode === 'corner' ? localToCorner(part.size, position) : position;

  const setPositionAxis = (position: Vec3, axis: AxisKey, value: number): Vec3 => {
    const shown = withAxis(displayPosition(position), axis, value);
    return draft.originMode === 'corner' ? cornerToLocal(part.size, shown) : shown;
  };

  const originControl = (
    <SegmentedControl
      label="位置の基準"
      value={draft.originMode}
      options={[
        { value: 'corner', label: 'コーナー原点' },
        { value: 'center', label: '中心原点' },
      ]}
      onChange={setOriginMode}
    />
  );

  const directionControl =
    op.type === 'roundHole' || op.type === 'rectHole' ? (
      <div className="field">
        <label className="field-label" htmlFor="op-direction">
          方向
        </label>
        <select
          id="op-direction"
          value={op.direction}
          onChange={(event) => patch({ direction: event.target.value as AxisDirection })}
        >
          {ALL_DIRECTIONS.map((dir) => (
            <option key={dir} value={dir}>
              {DIRECTION_LABELS[dir]} から掘る
            </option>
          ))}
        </select>
      </div>
    ) : null;

  const holePosition = (position: Vec3, direction: AxisDirection): ReactElement => {
    const [ua, va] = otherAxes(axisOf(direction));
    const shown = displayPosition(position);
    return (
      <div className="field-group">
        {originControl}
        <div className="vec3-field">
          <NumberField
            compact
            label={AXIS_LABELS[ua]}
            unit="mm"
            value={axisValue(shown, ua)}
            error={messageFor(result.errors, 'position')}
            warning={messageFor(result.warnings, 'position')}
            onCommit={(v) => patch({ position: setPositionAxis(position, ua, v) })}
          />
          <NumberField
            compact
            label={AXIS_LABELS[va]}
            unit="mm"
            value={axisValue(shown, va)}
            onCommit={(v) => patch({ position: setPositionAxis(position, va, v) })}
          />
        </div>
        <p className="muted">掘る深さの方向は「方向」で決まります</p>
      </div>
    );
  };

  return (
    <div className="op-form">
      {op.type === 'roundHole' ? (
        <>
          <NumberField
            label="直径"
            unit="mm"
            value={op.diameter}
            min={0}
            error={messageFor(result.errors, 'diameter')}
            onCommit={(diameter) => patch({ diameter })}
          />
          <label className="checkbox">
            <input type="checkbox" checked={op.through} onChange={(e) => patch({ through: e.target.checked })} />
            貫通させる
          </label>
          <NumberField
            label="深さ"
            unit="mm"
            value={op.depth}
            min={0}
            max={axisSize(part.size, axisOf(op.direction))}
            disabled={op.through}
            error={messageFor(result.errors, 'depth')}
            onCommit={(depth) => patch({ depth })}
          />
          {directionControl}
          {holePosition(op.position, op.direction)}
        </>
      ) : null}

      {op.type === 'rectHole' ? (
        <>
          <NumberField label="幅" unit="mm" value={op.width} min={0} error={messageFor(result.errors, 'width')} onCommit={(width) => patch({ width })} />
          <NumberField label="高さ" unit="mm" value={op.height} min={0} error={messageFor(result.errors, 'height')} onCommit={(height) => patch({ height })} />
          <label className="checkbox">
            <input type="checkbox" checked={op.through} onChange={(e) => patch({ through: e.target.checked })} />
            貫通させる
          </label>
          <NumberField
            label="深さ"
            unit="mm"
            value={op.depth}
            min={0}
            disabled={op.through}
            error={messageFor(result.errors, 'depth')}
            onCommit={(depth) => patch({ depth })}
          />
          {directionControl}
          {holePosition(op.position, op.direction)}
        </>
      ) : null}

      {op.type === 'notch' ? (
        <>
          <div className="field-group">
            <span className="field-label">削り取る寸法</span>
            <div className="vec3-field">
              <NumberField compact label="X" unit="mm" value={op.size.x} min={0} onCommit={(x) => patch({ size: { ...op.size, x } })} />
              <NumberField compact label="Y" unit="mm" value={op.size.y} min={0} onCommit={(y) => patch({ size: { ...op.size, y } })} />
              <NumberField compact label="Z" unit="mm" value={op.size.z} min={0} onCommit={(z) => patch({ size: { ...op.size, z } })} />
            </div>
          </div>
          <div className="field-group">
            {originControl}
            <div className="vec3-field">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <NumberField
                  key={axis}
                  compact
                  label={AXIS_LABELS[axis]}
                  unit="mm"
                  value={axisValue(displayPosition(op.position), axis)}
                  onCommit={(v) => patch({ position: setPositionAxis(op.position, axis, v) })}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {op.type === 'cut' ? (
        <>
          <SegmentedControl
            label="切断する向き"
            value={op.axis}
            options={[
              { value: 'x', label: 'X' },
              { value: 'y', label: 'Y' },
              { value: 'z', label: 'Z' },
            ]}
            onChange={(axis) => patch({ axis })}
          />
          <NumberField
            label={`切断位置（コーナーから ${AXIS_LABELS[op.axis]}）`}
            unit="mm"
            value={op.offset + axisSize(part.size, op.axis) / 2}
            min={0}
            max={axisSize(part.size, op.axis)}
            error={messageFor(result.errors, 'offset')}
            warning={messageFor(result.warnings, 'offset')}
            onCommit={(v) => patch({ offset: v - axisSize(part.size, op.axis) / 2 })}
          />
          <SegmentedControl
            label="残す側"
            value={op.keep}
            options={[
              { value: 'negative', label: `${AXIS_LABELS[op.axis]}- 側` },
              { value: 'positive', label: `${AXIS_LABELS[op.axis]}+ 側` },
            ]}
            onChange={(keep) => patch({ keep })}
          />
        </>
      ) : null}

      {result.errors.filter((e) => !e.field).map((e) => (
        <p key={e.message} className="notice notice-error">
          {e.message}
        </p>
      ))}
      {result.warnings.filter((w) => !w.field).map((wn) => (
        <p key={wn.message} className="notice notice-warning">
          {wn.message}
        </p>
      ))}
    </div>
  );
}

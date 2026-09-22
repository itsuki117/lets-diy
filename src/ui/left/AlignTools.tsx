import { useState } from 'react';
import { AlignCenterVertical, AlignEndVertical, AlignStartVertical } from 'lucide-react';
import type { AlignAnchor, AxisKey } from '../../core/types';
import { alignParts } from '../../store/commands/transformCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { SegmentedControl } from '../common/SegmentedControl';

const ANCHORS: Array<{ value: AlignAnchor; label: string; Icon: typeof AlignStartVertical }> = [
  { value: 'min', label: '最小', Icon: AlignStartVertical },
  { value: 'center', label: '中心', Icon: AlignCenterVertical },
  { value: 'max', label: '最大', Icon: AlignEndVertical },
];

export function AlignTools() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const [axis, setAxis] = useState<AxisKey>('x');
  const disabled = selectedIds.length < 2;

  return (
    <div className="tool-block">
      <span className="field-label">整列</span>
      <SegmentedControl
        value={axis}
        onChange={setAxis}
        disabled={disabled}
        options={[
          { value: 'x', label: 'X' },
          { value: 'y', label: 'Y' },
          { value: 'z', label: 'Z' },
        ]}
      />
      <div className="button-row">
        {ANCHORS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            title={`${axis.toUpperCase()} 軸の${label}で揃える`}
            onClick={() => alignParts(selectedIds, axis, value)}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {disabled ? <p className="muted">2 つ以上の部材を選ぶと使えます</p> : null}
    </div>
  );
}

import { Copy, Crosshair, Move3d, RotateCw, Trash2 } from 'lucide-react';
import type { AngleSnapValue, GridSnapValue } from '../../core/types';
import { duplicateParts, removeParts } from '../../store/commands/partCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { focusOnParts } from '../../store/cameraCommands';
import { SegmentedControl } from '../common/SegmentedControl';
import { AlignTools } from './AlignTools';
import { FaceSnapWizard } from './FaceSnapWizard';

const GRID_OPTIONS: ReadonlyArray<{ value: GridSnapValue; label: string }> = [
  { value: 0, label: 'OFF' },
  { value: 1, label: '1' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
];

const ANGLE_OPTIONS: ReadonlyArray<{ value: AngleSnapValue; label: string }> = [
  { value: 0, label: 'OFF' },
  { value: 15, label: '15' },
  { value: 45, label: '45' },
  { value: 90, label: '90' },
];

export function ArrangePanel() {
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const setGizmoMode = useEditorStore((s) => s.setGizmoMode);
  const snap = useEditorStore((s) => s.snap);
  const setSnap = useEditorStore((s) => s.setSnap);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="panel-content">
      <p className="eyebrow">ARRANGE</p>
      <h2>配置する</h2>

      <div className="tool-block">
        <span className="field-label">ギズモ</span>
        <div className="button-row">
          <button
            type="button"
            className={gizmoMode === 'translate' ? 'active' : undefined}
            title="移動 (G)"
            onClick={() => setGizmoMode('translate')}
          >
            <Move3d size={15} aria-hidden />
            移動
          </button>
          <button
            type="button"
            className={gizmoMode === 'rotate' ? 'active' : undefined}
            title="回転 (R)"
            onClick={() => setGizmoMode('rotate')}
          >
            <RotateCw size={15} aria-hidden />
            回転
          </button>
        </div>
      </div>

      <div className="tool-block">
        <span className="field-label">スナップ</span>
        <SegmentedControl
          label="グリッド (mm)"
          value={snap.grid}
          options={GRID_OPTIONS}
          onChange={(grid) => setSnap({ grid })}
        />
        <SegmentedControl
          label="角度 (°)"
          value={snap.angle}
          options={ANGLE_OPTIONS}
          onChange={(angle) => setSnap({ angle })}
        />
      </div>

      <FaceSnapWizard />
      <AlignTools />

      <div className="tool-block">
        <span className="field-label">編集</span>
        <div className="button-row">
          <button type="button" disabled={!hasSelection} title="複製 (Ctrl+D)" onClick={() => duplicateParts(selectedIds)}>
            <Copy size={15} aria-hidden />
            複製
          </button>
          <button type="button" disabled={!hasSelection} title="削除 (Delete)" onClick={() => removeParts(selectedIds)}>
            <Trash2 size={15} aria-hidden />
            削除
          </button>
          <button type="button" title="選択部材にカメラを寄せる (F)" onClick={() => focusOnParts(selectedIds)}>
            <Crosshair size={15} aria-hidden />
            寄る
          </button>
        </div>
        {!hasSelection ? <p className="muted">部材を選ぶと使えます</p> : null}
      </div>
    </div>
  );
}

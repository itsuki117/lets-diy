import { useState } from 'react';
import { Plus } from 'lucide-react';
import { MATERIAL_LABELS, MATERIAL_PRESETS, DEFAULT_PART_SIZE, MAX_SIZE_MM, MIN_SIZE_MM } from '../../core/constants';
import { nextPartName } from '../../core/part/createPart';
import { worldAabb } from '../../core/part/partBounds';
import type { MaterialKind, Size3, Vec3 } from '../../core/types';
import { addPart } from '../../store/commands/partCommands';
import { getCameraTarget } from '../../store/cameraCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from '../common/NumberField';

type Placement = 'origin' | 'nextTo' | 'camera';

export function CreatePanel() {
  const parts = useProjectStore((s) => s.project.parts);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setMode = useEditorStore((s) => s.setMode);

  const [size, setSize] = useState<Size3>({ ...DEFAULT_PART_SIZE });
  const [material, setMaterial] = useState<MaterialKind>('plywood');
  const [name, setName] = useState('');
  const [placement, setPlacement] = useState<Placement>('nextTo');

  const setAxis = (axis: keyof Size3, value: number): void => setSize((prev) => ({ ...prev, [axis]: value }));

  const computePosition = (): Vec3 => {
    if (placement === 'camera') return getCameraTarget();
    const selected = parts.find((p) => p.id === selectedIds[0]);
    if (placement === 'nextTo' && selected) {
      const box = worldAabb(selected);
      return [box.max[0] + 20 + size.x / 2, size.y / 2, (box.min[2] + box.max[2]) / 2];
    }
    return [0, size.y / 2, 0];
  };

  const handleCreate = (): void => {
    addPart({
      name: name.trim() || nextPartName(parts.map((p) => p.name)),
      size,
      material,
      position: computePosition(),
    });
    setName('');
    setMode('arrange');
  };

  return (
    <div className="panel-content">
      <p className="eyebrow">MATERIAL</p>
      <h2>木材をつくる</h2>
      <p className="muted">寸法を決めて、最初の一枚から。</p>

      <div className="field-group">
        <span className="field-label">材料プリセット</span>
        <div className="preset-grid">
          {MATERIAL_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="preset-btn"
              onClick={() => {
                setSize({ ...preset.size });
                setMaterial(preset.material);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <span className="field-label">寸法</span>
        <NumberField label="横幅 (X)" unit="mm" min={MIN_SIZE_MM} max={MAX_SIZE_MM} value={size.x} onCommit={(v) => setAxis('x', v)} />
        <NumberField label="高さ (Y)" unit="mm" min={MIN_SIZE_MM} max={MAX_SIZE_MM} value={size.y} onCommit={(v) => setAxis('y', v)} />
        <NumberField label="厚み (Z)" unit="mm" min={MIN_SIZE_MM} max={MAX_SIZE_MM} value={size.z} onCommit={(v) => setAxis('z', v)} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="create-material">
          材質
        </label>
        <select
          id="create-material"
          value={material}
          onChange={(event) => setMaterial(event.target.value as MaterialKind)}
        >
          {(Object.keys(MATERIAL_LABELS) as MaterialKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {MATERIAL_LABELS[kind]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="create-name">
          名前
        </label>
        <input
          id="create-name"
          value={name}
          placeholder={nextPartName(parts.map((p) => p.name))}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <fieldset className="field-group radio-group">
        <legend className="field-label">配置先</legend>
        <label className="radio">
          <input type="radio" name="placement" checked={placement === 'origin'} onChange={() => setPlacement('origin')} />
          原点
        </label>
        <label className="radio">
          <input type="radio" name="placement" checked={placement === 'camera'} onChange={() => setPlacement('camera')} />
          カメラの注視点
        </label>
        <label className="radio">
          <input type="radio" name="placement" checked={placement === 'nextTo'} onChange={() => setPlacement('nextTo')} />
          選択中の部材の右隣
        </label>
      </fieldset>

      <button type="button" className="btn-primary" onClick={handleCreate}>
        <Plus size={16} aria-hidden />
        木材を生成する
      </button>
    </div>
  );
}

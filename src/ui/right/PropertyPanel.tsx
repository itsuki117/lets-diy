import { Box, Copy, Trash2 } from 'lucide-react';
import { MATERIAL_LABELS, MAX_SIZE_MM, MIN_SIZE_MM } from '../../core/constants';
import type { MaterialKind, Vec3 } from '../../core/types';
import { duplicateParts, removeParts, renamePart, setPartMaterial, setPartSize } from '../../store/commands/partCommands';
import { setPartPosition, setPartRotation } from '../../store/commands/transformCommands';
import { useSelectedPart, useSelectedParts } from '../../store/selectors';
import { useEditorStore } from '../../store/useEditorStore';
import { NumberField } from '../common/NumberField';
import { Section } from '../common/Section';
import { Vec3Field } from '../common/Vec3Field';
import { MotionSection } from './MotionSection';
import { RestPoseNotice } from './RestPoseNotice';
import { OperationList } from './OperationList';

export function PropertyPanel() {
  const part = useSelectedPart();
  const selected = useSelectedParts();
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectedJointId = useEditorStore((s) => s.selectedJointId);

  if (selected.length === 0) {
    return (
      <aside className="right-panel">
        <div className="panel-heading">プロパティ</div>
        <div className="panel-scroll">
          {/* 可動は部材を選んでいなくても操作できる（joint 自体が選択対象のため） */}
          <MotionSection />
          {selectedJointId ? null : (
            <div className="empty-state">
              <Box size={30} aria-hidden />
              <h3>部材の詳細</h3>
              <p>
                部材を選択すると
                <br />
                ここに詳細が表示されます
              </p>
            </div>
          )}
        </div>
      </aside>
    );
  }

  if (!part) {
    return (
      <aside className="right-panel">
        <div className="panel-heading">プロパティ</div>
        <div className="panel-scroll">
          <div className="panel-content">
            <p className="muted">{selected.length} 件の部材を選択中</p>
            <div className="button-row">
              <button type="button" onClick={() => duplicateParts(selectedIds)}>
                <Copy size={15} aria-hidden />
                複製
              </button>
              <button type="button" onClick={() => removeParts(selectedIds)}>
                <Trash2 size={15} aria-hidden />
                削除
              </button>
            </div>
            <p className="muted">整列は左の［配置］パネルから実行できます。</p>
          </div>
        </div>
      </aside>
    );
  }

  const locked = part.locked;

  return (
    <aside className="right-panel">
      <div className="panel-heading">プロパティ</div>
      <div className="panel-scroll">
        <Section title="基本情報">
          <div className="field">
            <label className="field-label" htmlFor="prop-name">
              名前
            </label>
            <input
              id="prop-name"
              key={part.id}
              defaultValue={part.name}
              onBlur={(event) => renamePart(part.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="prop-material">
              材質
            </label>
            <select
              id="prop-material"
              value={part.material}
              onChange={(event) => setPartMaterial(part.id, event.target.value as MaterialKind)}
            >
              {(Object.keys(MATERIAL_LABELS) as MaterialKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {MATERIAL_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="寸法 (mm)">
          <NumberField label="横幅 (X)" unit="mm" min={MIN_SIZE_MM} max={MAX_SIZE_MM} disabled={locked} value={part.size.x} onCommit={(x) => setPartSize(part.id, { ...part.size, x })} />
          <NumberField label="高さ (Y)" unit="mm" min={MIN_SIZE_MM} max={MAX_SIZE_MM} disabled={locked} value={part.size.y} onCommit={(y) => setPartSize(part.id, { ...part.size, y })} />
          <NumberField label="厚み (Z)" unit="mm" min={MIN_SIZE_MM} max={MAX_SIZE_MM} disabled={locked} value={part.size.z} onCommit={(z) => setPartSize(part.id, { ...part.size, z })} />
        </Section>

        <RestPoseNotice partId={part.id} />

        <Section title="位置 (mm)">
          <Vec3Field
            value={part.transform.position}
            unit="mm"
            disabled={locked}
            onCommit={(position: Vec3) => setPartPosition(part.id, position)}
          />
        </Section>

        <Section title="回転 (°)">
          <Vec3Field
            value={part.transform.rotation}
            unit="deg"
            step={15}
            disabled={locked}
            onCommit={(rotation: Vec3) => setPartRotation(part.id, rotation)}
          />
        </Section>

        <Section title="加工" badge={part.operations.length}>
          <OperationList part={part} />
        </Section>

        <MotionSection />
      </div>
    </aside>
  );
}

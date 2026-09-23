import { useMemo, useState } from 'react';
import { Minus, Plus, Trash2, Wrench } from 'lucide-react';
import { HARDWARE_PRESETS } from '../../core/hardware/presets';
import { gasSpringCurve } from '../../core/motion/gasSpring';
import type { Vec3 } from '../../core/types';
import { addHardware, moveHardware, removeHardware } from '../../store/commands/hardwareCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from '../common/NumberField';
import { Section } from '../common/Section';

export function HardwarePanel() {
  const project = useProjectStore((state) => state.project);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selectedHardwareId = useEditorStore((state) => state.selectedHardwareId);
  const selectHardware = useEditorStore((state) => state.selectHardware);
  const [presetId, setPresetId] = useState(HARDWARE_PRESETS[0]!.presetId);
  const [basePartId, setBasePartId] = useState('');
  const [movingPartId, setMovingPartId] = useState('');
  const [quantity, setQuantity] = useState(2);
  const [position, setPosition] = useState<Vec3>([0, 0, 0]);
  const [autoHoles, setAutoHoles] = useState(true);
  const preset = useMemo(() => HARDWARE_PRESETS.find((item) => item.presetId === presetId)!, [presetId]);
  const gasCurves = useMemo(() => project.gasSprings.flatMap((mount) => {
    const joint = project.joints.find((item) => item.id === mount.jointId);
    if (!joint || joint.kind !== 'revolute') return [];
    const hardware = project.hardware.find((item) => item.id === mount.hardwareId);
    return [{ mount, label: hardware?.preset.label ?? 'ガススプリング', curve: gasSpringCurve(mount, joint, project) }];
  }), [project]);
  const pick = selectedIds[0] ?? '';
  const setCoord = (index: 0 | 1 | 2, value: number) => setPosition((current) => current.map((entry, i) => i === index ? value : entry) as unknown as Vec3);

  return (
    <>
      <Section title="金物を取り付ける" icon={<Wrench size={15} aria-hidden />} defaultOpen>
        <label className="field"><span>プリセット</span><select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
          {HARDWARE_PRESETS.map((item) => <option key={item.presetId} value={item.presetId}>{item.label}</option>)}
        </select></label>
        <p className="muted">{preset.partNumber ?? '型番なし'} / {preset.holes.length} 穴</p>
        <label className="field"><span>固定側</span><select value={basePartId} onChange={(event) => setBasePartId(event.target.value)}><option value="">選択してください</option>{project.parts.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>
        <button type="button" disabled={!pick} onClick={() => setBasePartId(pick)}>選択中を固定側に設定</button>
        <label className="field"><span>動く側</span><select value={movingPartId} onChange={(event) => setMovingPartId(event.target.value)}><option value="">選択してください</option>{project.parts.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>
        <button type="button" disabled={!pick} onClick={() => setMovingPartId(pick)}>選択中を動く側に設定</button>
        <NumberField label="数量（個）" value={quantity} min={1} max={100} onCommit={(value) => setQuantity(Math.max(1, Math.floor(value)))} />
        <div className="field"><span>取付位置（固定側ローカル）</span>{(['X', 'Y', 'Z'] as const).map((axis, index) => <div className="nudge-row" key={axis}><span className="nudge-axis">{axis}</span><button type="button" className="icon-btn" aria-label={`${axis}を減らす`} onClick={() => setCoord(index as 0 | 1 | 2, position[index]! - 1)}><Minus size={13}/></button><NumberField label={axis} unit="mm" value={position[index]!} onCommit={(value) => setCoord(index as 0 | 1 | 2, value)} /><button type="button" className="icon-btn" aria-label={`${axis}を増やす`} onClick={() => setCoord(index as 0 | 1 | 2, position[index]! + 1)}><Plus size={13}/></button></div>)}</div>
        <label className="toggle"><input type="checkbox" checked={autoHoles} onChange={(event) => setAutoHoles(event.target.checked)} />必要な穴を自動であける</label>
        {preset.kind === 'hinge' && preset.presetId === 'hinge.concealed.35' ? <p className="notice">軌跡は回転で近似しています。</p> : null}
        <button type="button" className="primary" disabled={!basePartId || !movingPartId || basePartId === movingPartId} onClick={() => addHardware({ preset, basePartId, movingPartId, position, quantity, autoHoles })}>取り付ける</button>
      </Section>
      <Section title={`取り付け済み (${project.hardware.length})`} icon={<Wrench size={15} aria-hidden />}>
        <div className="op-list">{project.hardware.map((hardware) => <div className={`op-row ${selectedHardwareId === hardware.id ? 'op-row-active' : ''}`} key={hardware.id}><button type="button" className="op-select" onClick={() => selectHardware(hardware.id)}><span className="op-label">{hardware.preset.label} ×{hardware.quantity}</span></button><button type="button" className="icon-btn" aria-label={`${hardware.preset.label}を削除`} onClick={() => { removeHardware(hardware.id); if (selectedHardwareId === hardware.id) selectHardware(null); }}><Trash2 size={14}/></button>{selectedHardwareId === hardware.id ? <div className="nudge-grid">{([['X', 0], ['Y', 1], ['Z', 2]] as const).map(([axis, index]) => <div className="nudge-row" key={axis}><span className="nudge-axis">{axis}</span><button type="button" className="icon-btn" aria-label={`${axis}を減らす`} onClick={() => { const next = [...hardware.position] as [number, number, number]; next[index] -= 1; moveHardware(hardware.id, next); }}><Minus size={13}/></button><button type="button" className="icon-btn" aria-label={`${axis}を増やす`} onClick={() => { const next = [...hardware.position] as [number, number, number]; next[index] += 1; moveHardware(hardware.id, next); }}><Plus size={13}/></button></div>)}</div> : null}</div>)}</div>
      </Section>
      {gasCurves.length > 0 ? <Section title="ガススプリング目安" defaultOpen>
        <p className="notice notice-warning">強度計算ではなく取付位置の当たりを付けるための目安です。</p>
        {gasCurves.map(({ mount, label, curve }) => {
          const maxLength = Math.max(...curve.map((point) => point.lengthMm), 1);
          const lengthPoints = curve.map((point, index) => `${(index / Math.max(1, curve.length - 1)) * 240},${76 - (point.lengthMm / maxLength) * 68}`).join(' ');
          const feasible = curve.filter((point) => point.feasible).length;
          return <div key={mount.id} className="gas-card"><strong>{label}</strong><svg viewBox="0 0 240 80" role="img" aria-label="角度に対する取付点間距離"><polyline points={lengthPoints} fill="none" stroke="currentColor" strokeWidth="2" /></svg><span className="muted">成立 {feasible}/{curve.length} 点 / 呼び力 {mount.forceN}N</span></div>;
        })}
      </Section> : null}
    </>
  );
}

import { useMemo } from 'react';
import { ArrowLeftRight, Minus, MousePointerClick, Plus, RotateCw, Sparkles, Trash2, Wrench, X } from 'lucide-react';
import { DIRECTION_LABELS } from '../../core/math/axis';
import { HARDWARE_PRESETS } from '../../core/hardware/presets';
import { GAS_TYPE_LABELS } from '../../core/motion/gasSpring';
import type { GasSpringMount, Hardware, HardwarePreset, Vec3 } from '../../core/types';
import { confirmPlacement, nudgePlacement, placementPlan, startPlacement } from '../../store/commands/placementCommands';
import {
  autoPlaceGasSpring,
  flipRailDirection,
  moveHardware,
  removeHardware,
  setGasAnchors,
} from '../../store/commands/hardwareCommands';
import { useEditorStore, type PlacementPoint } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from '../common/NumberField';
import { Section } from '../common/Section';

/** プリセットごとの「何に使うか」。動きは金物の種類と取付位置で決まる */
function usage(preset: HardwarePreset): string {
  if (preset.kind === 'hinge') {
    return `ピンのまわりに回ります。最大 ${preset.defaultRange?.max ?? 0}° まで開きます。`;
  }
  if (preset.kind === 'slideRail') {
    return `レールの長さ方向に ${preset.defaultRange?.max ?? 0}mm 引き出せます。左右 1 対で付けます。`;
  }
  if (preset.kind === 'linearGuide') {
    return `レールに沿ってブロックが ${preset.defaultRange?.max ?? 0}mm 動きます。取付面に沿って上下に動くように付けます（上下が無ければ長い方向）。`;
  }
  if (preset.kind === 'latch') {
    return preset.latchMode === 'manual'
      ? '決まった位置まで動かしてから、手で掛けて固定します。外すまで動きません。'
      : '決まった位置まで動くと自動で掛かり、外すまで動きません。';
  }
  if (preset.kind === 'bracket') {
    return '2 つの部材の内側の角に付けて固定します。取り付ける側は固定側と一緒に動きます。';
  }
  const spec = preset.gasSpring;
  if (!spec) return '';
  const stroke = `${spec.strokeMin}〜${spec.strokeMax}mm`;
  switch (spec.type ?? 'push') {
    case 'push': return `伸びる向きに ${spec.forceN}N で押し、フタの持ち上げを補助して開いた状態を保ちます。取付点間 ${stroke} の外へは動きません。`;
    case 'locking': return `押し出し型と同じ働きで、ロックすると任意の角度で固定できます。取付点間 ${stroke}。`;
    case 'traction': return `縮む向きに ${spec.forceN}N で引き、扉を閉じた側へ引き込みます。取付点間 ${stroke}。`;
    case 'damper': return `速く動かすほど強く抵抗し、フラップ扉の落下やフタの閉まりをゆっくりにします。取付点間 ${stroke}。`;
  }
}

const DEFAULT_QUANTITY: Record<HardwarePreset['kind'], number> = {
  hinge: 2, slideRail: 2, linearGuide: 2, gasSpring: 1, latch: 1, bracket: 2,
};

/** 金物ごとに「どの面に何を置くか」 */
const FACE_PROMPT: Record<HardwarePreset['kind'], { base: string; moving: string }> = {
  hinge: { base: '側板などの面に、丁番の高さを決めて置く', moving: '扉・フタの裏面にマウスを乗せる' },
  slideRail: { base: '側板の内側の面に、レールを置く', moving: '引き出しの側面にマウスを乗せる' },
  linearGuide: { base: '柱・背板の面に、レールを置く', moving: '動く板の、柱に向いた面にマウスを乗せる' },
  gasSpring: { base: '動かない部材の面に、下端（ボディ）のブラケットを置く', moving: '動く部材の面で、上端（ロッド）の位置を選ぶ' },
  latch: { base: '動かない部材の面に、受け金具を置く', moving: '動く部材の面にマウスを乗せる' },
  bracket: { base: '固定する側の面（角をつくる面）に置く', moving: '取り付ける側の面（角をつくる面）にマウスを乗せる' },
};

const AXIS_NAMES = ['X', 'Y', 'Z'] as const;

function PointLabel({ point }: { point: PlacementPoint | null }) {
  const name = useProjectStore((state) => state.project.parts.find((part) => part.id === point?.partId)?.name);
  if (!point || !name) return null;
  return <>{`${name} の ${DIRECTION_LABELS[point.face]}`}</>;
}

export function HardwarePanel() {
  const project = useProjectStore((state) => state.project);
  const placement = useEditorStore((state) => state.placement);
  const options = useEditorStore((state) => state.placementOptions);
  const setOptions = useEditorStore((state) => state.setPlacementOptions);
  const setPlacement = useEditorStore((state) => state.setPlacement);
  const cancelPlacement = useEditorStore((state) => state.cancelPlacement);
  const grid = useEditorStore((state) => state.snap.grid);
  const selectedHardwareId = useEditorStore((state) => state.selectedHardwareId);
  const selectHardware = useEditorStore((state) => state.selectHardware);
  const preset = useMemo(() => HARDWARE_PRESETS.find((item) => item.presetId === options.presetId) ?? HARDWARE_PRESETS[0]!, [options.presetId]);
  const prompt = FACE_PROMPT[preset.kind];
  const plan = useMemo(
    () => (placement.step === 'moving' || placement.step === 'ready' ? placementPlan(project, placement, options) : null),
    [project, placement, options],
  );
  const groups: Array<[string, HardwarePreset['kind']]> = [
    ['丁番', 'hinge'], ['スライドレール', 'slideRail'], ['リニアガイド', 'linearGuide'],
    ['ガススプリング・ダンパー', 'gasSpring'], ['ドアロック', 'latch'], ['固定金具', 'bracket'],
  ];
  const faceAxis = placement.base ? (placement.base.face[1] === 'x' ? 0 : placement.base.face[1] === 'y' ? 1 : 2) : -1;
  const rotatable = preset.kind === 'linearGuide' || preset.kind === 'slideRail';

  return (
    <>
      <Section title="金物を取り付ける" icon={<Wrench size={15} aria-hidden />} defaultOpen>
        <label className="field"><span>金物</span>
          <select value={options.presetId} onChange={(event) => {
            const next = HARDWARE_PRESETS.find((item) => item.presetId === event.target.value)!;
            setOptions({ presetId: next.presetId, quantity: DEFAULT_QUANTITY[next.kind] });
          }}>
            {groups.map(([label, kind]) => (
              <optgroup key={kind} label={label}>
                {HARDWARE_PRESETS.filter((item) => item.kind === kind).map((item) => <option key={item.presetId} value={item.presetId}>{item.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="muted hardware-usage">{usage(preset)}</p>

        {placement.step === null ? (
          <button type="button" className="primary" onClick={startPlacement}><MousePointerClick size={14} aria-hidden />取り付けを始める</button>
        ) : (
          <ol className="wizard face-steps" aria-label="取り付けの手順">
            <li className={placement.step === 'base' ? 'current' : 'done'}>
              <span className="wizard-index">1</span>
              <span className="face-step-text">
                <strong>固定側を置く</strong>
                <small>{placement.base && placement.step !== 'base' ? <PointLabel point={placement.base} /> : prompt.base}</small>
              </span>
              {placement.step !== 'base' ? (
                <button type="button" onClick={() => setPlacement({ step: 'base', moving: null, hover: null })}>置き直す</button>
              ) : null}
            </li>
            {placement.base && placement.step !== 'base' ? (
              <li className="placement-adjust">
                <div className="nudge-grid">
                  {[0, 1, 2].filter((axis) => axis !== faceAxis).map((axis) => (
                    <div className="nudge-row" key={axis}>
                      <span className="nudge-axis">{AXIS_NAMES[axis]}</span>
                      <button type="button" className="icon-btn" aria-label={`${AXIS_NAMES[axis]}を減らす`} onClick={() => nudgePlacement(axis as 0 | 1 | 2, -1)}><Minus size={13} /></button>
                      <span className="nudge-value">{Math.round(placement.base!.point[axis]!)}</span>
                      <button type="button" className="icon-btn" aria-label={`${AXIS_NAMES[axis]}を増やす`} onClick={() => nudgePlacement(axis as 0 | 1 | 2, 1)}><Plus size={13} /></button>
                    </div>
                  ))}
                </div>
                <small className="muted">矢印 1 回で {grid > 0 ? grid : 1}mm（グリッド）</small>
                {rotatable ? (
                  <div className="button-row">
                    <button type="button" onClick={() => setPlacement({ turn: !placement.turn })}><RotateCw size={13} aria-hidden />90°回す</button>
                    <button type="button" onClick={() => setPlacement({ flip: !placement.flip })}><ArrowLeftRight size={13} aria-hidden />向きを反転</button>
                  </div>
                ) : null}
              </li>
            ) : null}
            <li className={placement.step === 'moving' ? 'current' : placement.step === 'ready' ? 'done' : ''}>
              <span className="wizard-index">2</span>
              <span className="face-step-text">
                <strong>動く側を選ぶ</strong>
                <small>{placement.moving && placement.step === 'ready' ? <PointLabel point={placement.moving} /> : prompt.moving}</small>
              </span>
              {placement.step === 'ready' ? (
                <button type="button" onClick={() => setPlacement({ step: 'moving', moving: null })}>選び直す</button>
              ) : null}
            </li>
          </ol>
        )}

        {plan ? (
          'error' in plan ? (
            <p className="notice notice-warning">{plan.error}</p>
          ) : (
            plan.messages.map(([kind, message]) => <p key={message} className={`notice ${kind === 'success' ? 'notice-ok' : 'notice-warning'}`}>{message}</p>)
          )
        ) : null}

        <NumberField label="数量（個）" value={options.quantity} min={1} max={10} onCommit={(value) => setOptions({ quantity: Math.max(1, Math.floor(value)) })} />
        <label className="toggle"><input type="checkbox" checked={options.autoHoles} onChange={(event) => setOptions({ autoHoles: event.target.checked })} />必要な穴を自動であける</label>
        {preset.mountGap !== undefined ? (
          <label className="toggle"><input type="checkbox" checked={options.snapToMount} onChange={(event) => setOptions({ snapToMount: event.target.checked })} />動く側を金物の厚み（{preset.mountGap}mm）の位置へ寄せる</label>
        ) : null}
        {preset.kind === 'latch' ? (
          <label className="field"><span>ロックが掛かる位置</span>
            <select value={options.latchAt} onChange={(event) => setOptions({ latchAt: event.target.value as 'auto' | 'min' | 'max' })}>
              <option value="auto">おまかせ（直進は動ききった端、回転は閉じた位置）</option>
              <option value="max">動ききった端（上端・開ききり）</option>
              <option value="min">動き始めの端（下端・閉じた位置）</option>
            </select>
          </label>
        ) : null}
        {preset.kind === 'latch' || preset.kind === 'gasSpring' ? <p className="notice">動きを補助する金物です。丁番・レール・リニアガイドで動く部材（またはそれに金具で付けた部材）に付けます。</p> : null}

        {placement.step !== null ? (
          <div className="button-row">
            <button type="button" className="primary" disabled={placement.step !== 'ready' || !plan || 'error' in plan} onClick={() => confirmPlacement()}>取り付ける</button>
            <button type="button" onClick={cancelPlacement}><X size={14} aria-hidden />やめる</button>
          </div>
        ) : null}
      </Section>
      <Section title={`取り付け済み (${project.hardware.length})`} icon={<Wrench size={15} aria-hidden />}>
        <div className="op-list">{project.hardware.map((hardware) => (
          <div className={`op-row hardware-row ${selectedHardwareId === hardware.id ? 'op-row-active' : ''}`} key={hardware.id}>
            <div className="hardware-row-head">
              <button type="button" className="op-select" onClick={() => selectHardware(hardware.id)}>
                <span className="op-label">{hardware.preset.label} ×{hardware.quantity}</span>
              </button>
              <button type="button" className="icon-btn" aria-label={`${hardware.preset.label}を削除`} onClick={() => { removeHardware(hardware.id); if (selectedHardwareId === hardware.id) selectHardware(null); }}><Trash2 size={14} /></button>
            </div>
            {selectedHardwareId === hardware.id ? <HardwareAdjust hardware={hardware} mount={project.gasSprings.find((item) => item.hardwareId === hardware.id)} /> : null}
          </div>
        ))}</div>
      </Section>
    </>
  );
}

function HardwareAdjust({ hardware, mount }: { hardware: Hardware; mount: GasSpringMount | undefined }) {
  if (hardware.preset.kind === 'gasSpring') {
    if (!mount) return null;
    return (
      <div className="hardware-adjust">
        <span className="muted">{GAS_TYPE_LABELS[mount.type ?? 'push']} / 取付点間 {mount.strokeMin}〜{mount.strokeMax}mm / {mount.forceN}N</span>
        <AnchorField label="固定側の取付点" value={mount.baseAnchor} onCommit={(value) => setGasAnchors(mount.id, value, mount.movingAnchor)} />
        <AnchorField label="扉側の取付点（扉ローカル）" value={mount.movingAnchor} onCommit={(value) => setGasAnchors(mount.id, mount.baseAnchor, value)} />
        <button type="button" onClick={() => autoPlaceGasSpring(mount.id)}><Sparkles size={14} aria-hidden />取付位置を自動で決め直す</button>
      </div>
    );
  }
  const nudge = (index: 0 | 1 | 2, delta: number): void => {
    const next = [...hardware.position] as [number, number, number];
    next[index] += delta;
    moveHardware(hardware.id, next);
  };
  return (
    <div className="hardware-adjust">
      <div className="nudge-grid">{([['X', 0], ['Y', 1], ['Z', 2]] as const).map(([axis, index]) => (
        <div className="nudge-row" key={axis}>
          <span className="nudge-axis">{axis}</span>
          <button type="button" className="icon-btn" aria-label={`${axis}を減らす`} onClick={() => nudge(index, -1)}><Minus size={13} /></button>
          <button type="button" className="icon-btn" aria-label={`${axis}を増やす`} onClick={() => nudge(index, 1)}><Plus size={13} /></button>
        </div>
      ))}</div>
      {hardware.preset.kind === 'slideRail'
        ? <button type="button" onClick={() => flipRailDirection(hardware.id)}><ArrowLeftRight size={14} aria-hidden />引き出す向きを反転</button>
        : null}
    </div>
  );
}

function AnchorField({ label, value, onCommit }: { label: string; value: Vec3; onCommit: (value: Vec3) => void }) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <div className="vec3-field">
        {(['X', 'Y', 'Z'] as const).map((axis, index) => (
          <NumberField key={axis} compact label={axis} unit="mm" value={Math.round(value[index]! * 10) / 10}
            onCommit={(next) => onCommit(value.map((entry, i) => (i === index ? next : entry)) as unknown as Vec3)} />
        ))}
      </div>
    </div>
  );
}

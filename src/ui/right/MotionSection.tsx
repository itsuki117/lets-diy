import { useMemo } from 'react';
import { CircleCheck, Crosshair, DoorClosed, DoorOpen, Hand, Lock, LockOpen, ScanSearch, TriangleAlert } from 'lucide-react';
import { balanceCurve, buildMotionModel, type BalancePoint } from '../../core/motion/dynamics';
import { GAS_TYPE_LABELS, gasLengthAt, gasStaticForce, type JointGasSpring } from '../../core/motion/gasSpring';
import { scanJointMotion } from '../../core/motion/motionScan';
import { isMovableJoint, type MovableJoint } from '../../core/types';
import { latchValue } from '../../core/motion/limits';
import { applyMat3, rotationMatrix } from '../../core/math/matrix';
import { normalize } from '../../core/math/vec3';
import { simSetGasLock, simSetJointValue, simSetLatch } from '../../store/commands/simulationCommands';
import { useMotionStore } from '../../store/useMotionStore';
import { focusOnParts } from '../../store/cameraCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useMotionPlayer } from '../../store/useMotionPlayer';
import { useWorkingProject } from '../../store/useSimulationStore';
import { Section } from '../common/Section';

const round1 = (v: number): number => Math.round(v * 10) / 10;

/** 動きの向きの言葉。回転・上下の直進・水平の直進で変える */
interface MotionWords {
  hand: string;
  toMin: string;
  toMax: string;
  goesMax: string;
  goesMin: string;
  /** 色帯の凡例 */
  becomesMax: string;
  becomesMin: string;
  /** ドアロックの位置 */
  placeMax: string;
  placeMin: string;
  atMin: string;
}

function motionWords(joint: MovableJoint, vertical: boolean): MotionWords {
  if (joint.kind === 'revolute') {
    return { hand: '開閉', toMin: '閉じる', toMax: '開ききる', goesMax: '開いて', goesMin: '閉じて', becomesMax: '開く', becomesMin: '閉じる', placeMax: '開ききった', placeMin: '閉じた', atMin: '閉じた状態' };
  }
  if (vertical) {
    return { hand: '上げ下げ', toMin: '下げきる', toMax: '上げきる', goesMax: '上がって', goesMin: '下がって', becomesMax: '上がる', becomesMin: '下がる', placeMax: 'いちばん上の', placeMin: 'いちばん下の', atMin: 'いちばん下' };
  }
  return { hand: '引き出す', toMin: 'しまう', toMax: '引き出しきる', goesMax: '出て', goesMin: '戻って', becomesMax: '出る', becomesMin: '戻る', placeMax: '引き出しきった', placeMin: 'しまった', atMin: 'しまった状態' };
}

/**
 * 選択中の可動部を、手で動かして確かめる（設計書 DESIGN_V2 §9.3, §9.4）。
 *
 * 動く向き・範囲は金物から決まるので、ここでは設定させない。
 * スライダーは「手」。離すと、重力とガス圧で止まるところまで動く。
 */
export function MotionSection() {
  const selectedJointId = useEditorStore((s) => s.selectedJointId);
  const project = useWorkingProject();
  const joint = project.joints.find((j) => j.id === selectedJointId);
  if (!joint) return null;
  if (!isMovableJoint(joint)) {
    return (
      <Section title="動かして確認" badge="固定" defaultOpen>
        <p className="muted">固定なので動きません。親が動くと一緒に付いてきます。</p>
      </Section>
    );
  }
  return <MovableControls joint={joint} />;
}

function MovableControls({ joint }: { joint: MovableJoint }) {
  const project = useWorkingProject();
  const player = useMotionPlayer();
  const scan = useEditorStore((s) => s.motionScan);
  const setScan = useEditorStore((s) => s.setMotionScan);
  const select = useEditorStore((s) => s.select);
  const unit = joint.kind === 'revolute' ? '°' : 'mm';

  const hardware = project.hardware.filter((item) => item.jointId === joint.id);
  const latches = hardware.filter((item) => item.preset.kind === 'latch');
  const partName = (id: string): string => project.parts.find((p) => p.id === id)?.name ?? '?';
  const basePose = useMotionStore((s) => s.poses.get(joint.basePartId));
  const baseRotation = basePose?.rotation ?? project.parts.find((p) => p.id === joint.basePartId)?.transform.rotation ?? [0, 0, 0];
  const vertical = joint.kind === 'prismatic' && Math.abs(applyMat3(rotationMatrix(baseRotation), normalize(joint.axis))[1]) > 0.7;
  const words = motionWords(joint, vertical);

  // 手を離したあとの動きのモデル。値だけ変わったときは作り直さない
  const structureKey = useMemo(
    () => JSON.stringify([
      project.parts.map((p) => [p.transform, p.size, p.material]),
      project.joints.map((j) => j.id === joint.id ? { ...j, value: 0 } : j),
      project.gasSprings,
      project.hardware.map((h) => h.latch),
    ]),
    [project.parts, project.joints, project.gasSprings, project.hardware, joint.id],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => buildMotionModel(project, joint.id), [structureKey]);
  const limits = model?.limits ?? { min: joint.range.min, max: joint.range.max, minReason: null, maxReason: null };
  const curve = useMemo(() => (model ? balanceCurve(model, 80) : []), [model]);
  const raw = model ? balanceCurve({ ...model, limits: { ...model.limits, min: joint.value, max: joint.value } }, 1)[0] : undefined;
  // 当たり止めに押し付けられているだけなら、動かない
  const resting = raw && ((raw.state === 'closes' && joint.value <= limits.min + 0.05) || (raw.state === 'opens' && joint.value >= limits.max - 0.05));
  const here = raw && resting ? { ...raw, state: 'holds' as const, handForceN: 0 } : raw;

  const busy = player.phase !== 'idle';
  const moving = player.phase === 'free' || player.phase === 'handMove';
  const stopAndRun = (action: () => void): void => {
    player.settle();
    action();
  };

  return (
    <>
      <Section title="動かして確認" badge={joint.kind === 'revolute' ? '回転' : '直進'} defaultOpen>
        <p className="muted">{partName(joint.basePartId)} に対して {partName(joint.movingPartId)} が動きます</p>
        <div className="mechanism-list">
          {hardware.map((item) => (
            <span key={item.id} className="mechanism-chip">{item.preset.label} ×{item.quantity}</span>
          ))}
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={player.physics} onChange={(event) => player.setPhysics(event.target.checked)} />
          重力とガス圧を反映する（手を離すと動く）
        </label>

        <div className="field">
          <label className="field-label" htmlFor="joint-slider">
            <Hand size={12} aria-hidden /> 手で{words.hand}
            <span className="joint-value">{round1(joint.value)}{unit}</span>
          </label>
          <RangeTrack joint={joint} limits={limits} curve={curve} />
          <input
            id="joint-slider"
            className="joint-slider"
            type="range"
            min={joint.range.min}
            max={joint.range.max}
            step={0.5}
            value={joint.value}
            disabled={!joint.enabled}
            onPointerDown={() => player.grab(joint.id)}
            onChange={(event) => {
              if (player.phase !== 'hand') player.grab(joint.id);
              player.drag(Number(event.target.value));
            }}
            onPointerUp={() => player.release()}
            onKeyUp={() => player.release()}
          />
          <div className="range-caption">
            <span>{round1(limits.min)}{unit}{limits.minReason ? `（${limits.minReason}）` : ''}</span>
            <span>{round1(limits.max)}{unit}{limits.maxReason ? `（${limits.maxReason}）` : ''}</span>
          </div>
        </div>

        <div className="button-row">
          <button type="button" disabled={!joint.enabled} onClick={() => player.moveTo(joint.id, limits.min)}>
            <DoorClosed size={15} aria-hidden />{words.toMin}
          </button>
          <button type="button" disabled={!joint.enabled} onClick={() => player.moveTo(joint.id, limits.max)}>
            <DoorOpen size={15} aria-hidden />{words.toMax}
          </button>
        </div>

        <ReleaseForecast joint={joint} words={words} point={here} moving={moving} velocity={player.velocity} lastStop={player.lastStop} physics={player.physics} />

        {latches.map((item) => (
          <LatchStatus
            key={item.id}
            label={item.preset.label}
            manual={item.preset.latchMode === 'manual'}
            engaged={item.latch?.engaged === true}
            where={item.latch?.at === 'min' ? words.placeMin : words.placeMax}
            onEngage={() => { player.settle(); player.moveTo(joint.id, latchValue(project, joint, item.latch?.at ?? 'max'), item.id); }}
            onRelease={() => stopAndRun(() => simSetLatch(item.id, false))}
          />
        ))}

        {model?.springs.map((spring) => (
          <GasSpringStatus
            key={spring.mount.id}
            joint={joint}
            spring={spring}
            onLock={(locked) => stopAndRun(() => simSetGasLock(spring.mount.id, locked))}
          />
        ))}

        {curve.length > 0 ? <BalanceLegend words={words} /> : null}

      </Section>

      <Section title="ぶつからないか確認" defaultOpen={false}>
        <MotionScanBlock
          joint={joint}
          unitLabel={unit}
          disabled={busy}
          scan={scan && scan.jointId === joint.id ? scan : null}
          onScan={() => setScan(scanJointMotion(project, joint.id))}
          onShow={(value, ids) => stopAndRun(() => {
            simSetJointValue(joint.id, value, false);
            select(ids);
            focusOnParts(ids);
          })}
        />
      </Section>
    </>
  );
}

/** 可動範囲のうち、金物で動けない区間と、手を離したときの動きを色で示す */
function RangeTrack({ joint, limits, curve }: { joint: MovableJoint; limits: { min: number; max: number }; curve: BalancePoint[] }) {
  const span = joint.range.max - joint.range.min || 1;
  const pct = (v: number): number => ((v - joint.range.min) / span) * 100;
  return (
    <div className="motion-track" aria-hidden>
      {curve.map((point, i) => {
        const next = curve[i + 1];
        if (!next) return null;
        return <span key={i} className={`motion-track-seg balance-${point.state}`} style={{ left: `${pct(point.q)}%`, width: `${pct(next.q) - pct(point.q) + 0.3}%` }} />;
      })}
      {limits.min > joint.range.min ? <span className="motion-track-blocked" style={{ left: 0, width: `${pct(limits.min)}%` }} /> : null}
      {limits.max < joint.range.max ? <span className="motion-track-blocked" style={{ left: `${pct(limits.max)}%`, right: 0 }} /> : null}
    </div>
  );
}

function BalanceLegend({ words }: { words: MotionWords }) {
  return (
    <div className="balance-legend">
      <span><i className="balance-closes" />離すと{words.becomesMin}</span>
      <span><i className="balance-holds" />その場で止まる</span>
      <span><i className="balance-opens" />離すと{words.becomesMax}</span>
      <span><i className="motion-track-blocked" />金物の都合で動けない</span>
    </div>
  );
}

function ReleaseForecast({ joint, words, point, moving, velocity, lastStop, physics }: {
  joint: MovableJoint; words: MotionWords; point: BalancePoint | undefined; moving: boolean; velocity: number; lastStop: string | null; physics: boolean;
}) {
  const unit = joint.kind === 'revolute' ? '°/s' : 'mm/s';
  if (moving) {
    return <p className="notice notice-boxed">動いています {Math.round(Math.abs(velocity))}{unit}</p>;
  }
  if (!physics || !point) {
    return <p className="notice notice-boxed">手を離した位置で止まります（重力とガス圧は反映していません）</p>;
  }
  const text = point.state === 'holds'
    ? (joint.value <= joint.range.min + 0.05 ? `${words.atMin}で止まっています` : 'この位置で手を離すと、その場で止まります')
    : `この位置で手を離すと、${point.state === 'opens' ? words.goesMax : words.goesMin}いきます`;
  return (
    <div className="notice notice-boxed forecast">
      <span className={point.state === 'holds' ? 'notice-ok' : 'notice-warning'}>
        {point.state === 'holds' ? <CircleCheck size={13} aria-hidden /> : <TriangleAlert size={13} aria-hidden />} {text}
      </span>
      {point.state !== 'holds' ? (
        <span className="muted">
          止めておくには、{joint.kind === 'revolute' ? '先端で' : ''}約 {round1(point.handForceN)} N（{round1(point.handForceN / 9.81)} kgf）の力が要ります
        </span>
      ) : null}
      {lastStop ? <span className="muted">直前の動き: {lastStop}で止まりました</span> : null}
    </div>
  );
}

/** ドアロックの状態と、掛ける / 外す操作 */
function LatchStatus({ label, manual, engaged, where, onEngage, onRelease }: {
  label: string; manual: boolean; engaged: boolean; where: string; onEngage: () => void; onRelease: () => void;
}) {
  return (
    <div className="gas-card">
      <div className="gas-card-head">
        <strong>{label}</strong>
        <span className={engaged ? 'notice-warning' : 'muted'}>{engaged ? '掛かっています' : '外れています'}</span>
      </div>
      <span className="muted">
        {engaged
          ? '外すまで動きません。'
          : manual
            ? `${where}位置で支えたまま、手で掛けます。`
            : `${where}位置まで動くと自動で掛かります。`}
      </span>
      {engaged ? (
        <button type="button" onClick={onRelease}><LockOpen size={14} aria-hidden />ロックを外す</button>
      ) : manual ? (
        <button type="button" onClick={onEngage}><Lock size={14} aria-hidden />{where}位置まで動かして掛ける</button>
      ) : null}
    </div>
  );
}

/** ガススプリングの今の長さと力。伸縮範囲のどこにいるかをバーで示す */
function GasSpringStatus({ joint, spring, onLock }: { joint: MovableJoint; spring: JointGasSpring; onLock: (locked: boolean) => void }) {
  const { lengthMm } = gasLengthAt(joint, spring, joint.value);
  const { strokeMin, strokeMax } = spring.spec;
  const ratio = Math.min(Math.max((lengthMm - strokeMin) / (strokeMax - strokeMin), 0), 1);
  const force = Math.abs(gasStaticForce(spring.spec, lengthMm)) * spring.quantity;
  const type = spring.spec.type;
  const locked = spring.mount.locked === true;
  return (
    <div className="gas-card">
      <div className="gas-card-head">
        <strong>{spring.label}</strong>
        <span className="muted">{GAS_TYPE_LABELS[type]} ×{spring.quantity}</span>
      </div>
      <div className="stroke-bar" aria-label={`伸縮 ${Math.round(ratio * 100)}%`}>
        <span className="stroke-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="range-caption">
        <span>縮みきり {strokeMin}</span>
        <span>{round1(lengthMm)} mm</span>
        <span>伸びきり {strokeMax}</span>
      </div>
      <span className="muted">
        {type === 'damper'
          ? `速く動かすほど強く抵抗します（戻し力 ${round1(force)} N）`
          : type === 'traction'
            ? `縮む向きに ${round1(force)} N で引いています`
            : `伸びる向きに ${round1(force)} N で押しています`}
        {spring.mount.rodEnd ? ` / ロッド${spring.mount.rodEnd === 'moving' ? '動く側' : '固定側'}` : ''}
      </span>
      {type === 'locking' ? (
        <button type="button" onClick={() => onLock(!locked)}>
          {locked ? <Lock size={14} aria-hidden /> : <LockOpen size={14} aria-hidden />}
          {locked ? 'ロック中（押して解除）' : 'この位置でロックする'}
        </button>
      ) : null}
    </div>
  );
}

interface ScanProps {
  joint: MovableJoint;
  unitLabel: string;
  disabled: boolean;
  scan: import('../../core/motion/motionScan').MotionScanResult | null;
  onScan: () => void;
  onShow: (value: number, partIds: string[]) => void;
}

/** 可動範囲を走査して、ぶつかる区間を出す（設計書 DESIGN_V2 §9.3） */
function MotionScanBlock({ joint, unitLabel, disabled, scan, onScan, onShow }: ScanProps) {
  const span = joint.range.max - joint.range.min || 1;
  const ratio = (value: number): number => ((value - joint.range.min) / span) * 100;

  return (
    <div className="tool-block">
      <button type="button" onClick={onScan} disabled={!joint.enabled || disabled}>
        <ScanSearch size={15} aria-hidden />
        全範囲をチェック
      </button>
      {scan ? (
        <>
          <div className="motion-range-bar" aria-hidden>
            {scan.blocked.map((block) => (
              <span key={`${block.fromValue}-${block.toValue}`} className="motion-range-blocked"
                style={{ left: `${ratio(block.fromValue)}%`, width: `${Math.max(ratio(block.toValue) - ratio(block.fromValue), 1.5)}%` }} />
            ))}
          </div>
          {scan.usable ? (
            <p className="notice notice-ok"><CircleCheck size={14} aria-hidden />{scan.usable.min}{unitLabel} 〜 {scan.usable.max}{unitLabel} はぶつかりません</p>
          ) : (
            <p className="notice notice-error"><TriangleAlert size={14} aria-hidden />全範囲でぶつかっています</p>
          )}
          {scan.blocked.map((block) => (
            <div key={`${block.fromValue}-${block.toValue}`} className="scan-row">
              <span className="notice notice-warning">
                <TriangleAlert size={13} aria-hidden />
                {block.fromValue}{unitLabel} 〜 {block.toValue}{unitLabel}: {block.pairs.map((p) => `${Math.round(p.depthMm * 10) / 10}mm`).join(' / ')}
              </span>
              <button type="button" className="icon-btn" title="この位置を表示" aria-label="この位置を表示"
                onClick={() => onShow(block.fromValue, block.pairs.flatMap((p) => [p.a, p.b]))}>
                <Crosshair size={13} aria-hidden />
              </button>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

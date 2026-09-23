import { CircleCheck, Crosshair, DoorClosed, DoorOpen, ScanSearch, TriangleAlert } from 'lucide-react';
import { isMovableJoint, jointUnit, JOINT_KIND_LABELS } from '../../core/types';
import {
  renameJoint,
  setJointEnabled,
  setJointRange,
  setJointValue,
  updateTransientJointValue,
} from '../../store/commands/jointCommands';
import { scanJointMotion } from '../../core/motion/motionScan';
import { focusOnParts } from '../../store/cameraCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from '../common/NumberField';
import { Section } from '../common/Section';

/**
 * 選択中の可動を動かす。
 *
 * スライダーのドラッグは Transient 扱いで、離したときに 1 履歴エントリになる
 * （Ver.1 のギズモと同じ扱い。設計書 DESIGN_V2 §9.3）。
 */
export function MotionSection() {
  const selectedJointId = useEditorStore((s) => s.selectedJointId);
  const joints = useProjectStore((s) => s.project.joints);
  const parts = useProjectStore((s) => s.project.parts);
  const beginTransient = useProjectStore((s) => s.beginTransient);
  const commitTransient = useProjectStore((s) => s.commitTransient);
  const project = useProjectStore((s) => s.project);
  const scan = useEditorStore((s) => s.motionScan);
  const setScan = useEditorStore((s) => s.setMotionScan);
  const select = useEditorStore((s) => s.select);

  const joint = joints.find((j) => j.id === selectedJointId);
  if (!joint) return null;

  const nameOf = (id: string): string => parts.find((p) => p.id === id)?.name ?? '?';
  const unit = jointUnit(joint.kind);

  return (
    <Section title="動かして確認" badge={JOINT_KIND_LABELS[joint.kind]} defaultOpen>
      <div className="field">
        <label className="field-label" htmlFor="joint-name">
          名前
        </label>
        <input
          id="joint-name"
          key={joint.id}
          defaultValue={joint.name}
          onBlur={(event) => renameJoint(joint.id, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </div>

      <p className="muted">
        {nameOf(joint.basePartId)} に対して {nameOf(joint.movingPartId)} が動きます
      </p>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={joint.enabled}
          onChange={(event) => setJointEnabled(joint.id, event.target.checked)}
        />
        この動作を有効にする
      </label>

      {isMovableJoint(joint) && unit ? (
        <>
          <div className="field">
            <label className="field-label" htmlFor="joint-slider">
              {joint.kind === 'revolute' ? '角度' : '引き出し量'}
              <span className="joint-value">
                {Math.round(joint.value * 10) / 10}
                {unit === 'deg' ? '°' : 'mm'}
              </span>
            </label>
            <input
              id="joint-slider"
              className="joint-slider"
              type="range"
              min={joint.range.min}
              max={joint.range.max}
              step={unit === 'deg' ? 1 : 1}
              value={joint.value}
              disabled={!joint.enabled}
              onPointerDown={() => beginTransient()}
              onChange={(event) => updateTransientJointValue(joint.id, Number(event.target.value))}
              onPointerUp={() => commitTransient(joint.kind === 'revolute' ? '開閉する' : '引き出す')}
              onKeyUp={() => commitTransient(joint.kind === 'revolute' ? '開閉する' : '引き出す')}
            />
          </div>

          <div className="button-row">
            <button
              type="button"
              disabled={!joint.enabled}
              onClick={() => setJointValue(joint.id, joint.range.min, '閉じる')}
            >
              <DoorClosed size={15} aria-hidden />
              閉じる
            </button>
            <button
              type="button"
              disabled={!joint.enabled}
              onClick={() => setJointValue(joint.id, joint.range.max, '開く')}
            >
              <DoorOpen size={15} aria-hidden />
              開く
            </button>
          </div>

          <MotionScanBlock
            joint={joint}
            unitLabel={unit === 'deg' ? '°' : 'mm'}
            scan={scan && scan.jointId === joint.id ? scan : null}
            onScan={() => setScan(scanJointMotion(project, joint.id))}
            onShow={(value, ids) => {
              setJointValue(joint.id, value, '干渉位置へ移動');
              select(ids);
              focusOnParts(ids);
            }}
          />

          <div className="field-group">
            <span className="field-label">動かせる範囲</span>
            <div className="vec3-field">
              <NumberField
                compact
                label="最小"
                unit={unit === 'deg' ? 'deg' : 'mm'}
                value={joint.range.min}
                onCommit={(min) => setJointRange(joint.id, { min, max: joint.range.max })}
              />
              <NumberField
                compact
                label="最大"
                unit={unit === 'deg' ? 'deg' : 'mm'}
                value={joint.range.max}
                onCommit={(max) => setJointRange(joint.id, { min: joint.range.min, max })}
              />
            </div>
          </div>
        </>
      ) : (
        <p className="muted">固定なので動きません。親を動かすと一緒に付いてきます。</p>
      )}
    </Section>
  );
}


interface ScanProps {
  joint: Extract<import('../../core/types').Joint, { kind: 'revolute' | 'prismatic' }>;
  unitLabel: string;
  scan: import('../../core/motion/motionScan').MotionScanResult | null;
  onScan: () => void;
  onShow: (value: number, partIds: string[]) => void;
}

/** 可動範囲を走査して、ぶつかる区間を出す（設計書 DESIGN_V2 §9.3） */
function MotionScanBlock({ joint, unitLabel, scan, onScan, onShow }: ScanProps) {
  const span = joint.range.max - joint.range.min || 1;
  const ratio = (value: number): number => ((value - joint.range.min) / span) * 100;

  return (
    <div className="tool-block">
      <button type="button" onClick={onScan} disabled={!joint.enabled}>
        <ScanSearch size={15} aria-hidden />
        全範囲をチェック
      </button>

      {scan ? (
        <>
          <div className="motion-range-bar" aria-hidden>
            {scan.blocked.map((block) => (
              <span
                key={`${block.fromValue}-${block.toValue}`}
                className="motion-range-blocked"
                style={{
                  left: `${ratio(block.fromValue)}%`,
                  width: `${Math.max(ratio(block.toValue) - ratio(block.fromValue), 1.5)}%`,
                }}
              />
            ))}
          </div>

          {scan.usable ? (
            <p className="notice notice-ok">
              <CircleCheck size={14} aria-hidden />
              {scan.usable.min}
              {unitLabel} 〜 {scan.usable.max}
              {unitLabel} は動きます
            </p>
          ) : (
            <p className="notice notice-error">
              <TriangleAlert size={14} aria-hidden />
              全範囲でぶつかっています
            </p>
          )}

          {scan.blocked.map((block) => (
            <div key={`${block.fromValue}-${block.toValue}`} className="scan-row">
              <span className="notice notice-warning">
                <TriangleAlert size={13} aria-hidden />
                {block.fromValue}
                {unitLabel} 〜 {block.toValue}
                {unitLabel}: {block.pairs.map((p) => `${Math.round(p.depthMm * 10) / 10}mm`).join(' / ')}
              </span>
              <button
                type="button"
                className="icon-btn"
                title="この位置を表示"
                aria-label="この位置を表示"
                onClick={() => onShow(block.fromValue, block.pairs.flatMap((p) => [p.a, p.b]))}
              >
                <Crosshair size={13} aria-hidden />
              </button>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

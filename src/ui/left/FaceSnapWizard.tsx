import { Magnet, X } from 'lucide-react';
import { ALL_DIRECTIONS, DIRECTION_LABELS } from '../../core/math/axis';
import type { AxisDirection, FaceRef } from '../../core/types';
import { applyFaceSnap } from '../../store/commands/transformCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from '../common/NumberField';

export function FaceSnapWizard() {
  const session = useEditorStore((s) => s.faceSnap);
  const start = useEditorStore((s) => s.startFaceSnap);
  const cancel = useEditorStore((s) => s.cancelFaceSnap);
  const reset = useEditorStore((s) => s.resetFaceSnapPicks);
  const setGap = useEditorStore((s) => s.setFaceSnapGap);
  const setCenterAlign = useEditorStore((s) => s.setFaceSnapCenterAlign);
  const parts = useProjectStore((s) => s.project.parts);

  const nameOf = (id: string): string => parts.find((p) => p.id === id)?.name ?? '?';
  const choose = (side: 'source' | 'target', face: FaceRef): void => {
    useEditorStore.setState((state) => {
      if (!state.faceSnap) return {};
      const next = { ...state.faceSnap, [side]: face };
      if (side === 'source' && next.target?.partId === face.partId) next.target = null;
      return { faceSnap: next };
    });
  };

  if (!session) {
    return (
      <div className="tool-block">
        <span className="field-label">面スナップ</span>
        <button type="button" onClick={start}>
          <Magnet size={15} aria-hidden />
          面スナップを開始
        </button>
        <p className="muted">2 つの面を選ぶと、ぴったり接触する位置へ移動します</p>
      </div>
    );
  }

  return (
    <div className="tool-block tool-block-active">
      <span className="field-label">面スナップ</span>
      <ol className="wizard">
        <li className={session.source ? 'done' : 'current'}>
          <span className="wizard-index">1</span>
          {session.source
            ? `${nameOf(session.source.partId)} / ${DIRECTION_LABELS[session.source.face]}`
            : '動かす部材の面をクリック'}
        </li>
        <li className={session.target ? 'done' : session.source ? 'current' : ''}>
          <span className="wizard-index">2</span>
          {session.target
            ? `${nameOf(session.target.partId)} / ${DIRECTION_LABELS[session.target.face]}`
            : '接触させる相手の面をクリック'}
        </li>
      </ol>

      {(['source', 'target'] as const).map((side) => {
        const label = side === 'source' ? '動かす部材' : '接触先の部材';
        const selected = session[side];
        return <div className="field-group" key={side}>
          <label className="field-label" htmlFor={`snap-${side}`}>{label}</label>
          <select id={`snap-${side}`} value={selected?.partId ?? ''} onChange={(event) => choose(side, { partId: event.target.value, face: selected?.face ?? (side === 'source' ? '-x' : '+x') })}>
            <option value="" disabled>部材を選ぶ</option>
            {parts.filter((p) => p.visible).map((p) => <option key={p.id} value={p.id} disabled={side === 'source' ? p.locked : p.id === session.source?.partId}>{p.name}</option>)}
          </select>
          <select aria-label={`${label}の面`} disabled={!selected} value={selected?.face ?? (side === 'source' ? '-x' : '+x')} onChange={(event) => { if (selected) choose(side, { ...selected, face: event.target.value as AxisDirection }); }}>
            {ALL_DIRECTIONS.map((face) => <option key={face} value={face}>{DIRECTION_LABELS[face]}</option>)}
          </select>
        </div>;
      })}

      <NumberField label="隙間" unit="mm" value={session.gap} onCommit={setGap} />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={session.centerAlign}
          onChange={(event) => setCenterAlign(event.target.checked)}
        />
        面の中心を合わせる
      </label>

      <div className="button-row">
        <button
          type="button"
          className="btn-primary"
          disabled={!session.source || !session.target}
          onClick={() => {
            if (!session.source || !session.target) return;
            if (applyFaceSnap(session.source, session.target, session.gap, session.centerAlign)) cancel();
          }}
        >
          <Magnet size={15} aria-hidden />
          適用
        </button>
        <button type="button" onClick={reset} disabled={!session.source}>
          選び直す
        </button>
        <button type="button" onClick={cancel} title="面スナップをやめる (Esc)">
          <X size={15} aria-hidden />
          やめる
        </button>
      </div>
    </div>
  );
}

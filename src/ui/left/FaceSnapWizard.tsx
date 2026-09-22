import { Magnet, X } from 'lucide-react';
import { DIRECTION_LABELS } from '../../core/math/axis';
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

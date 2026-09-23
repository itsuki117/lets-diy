import { Link, MoveHorizontal, RotateCw, Trash2, X } from 'lucide-react';
import { JOINT_KIND_LABELS, type JointKind } from '../../core/types';
import { addJoint, removeJoint } from '../../store/commands/jointCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

const KINDS: Array<{ kind: JointKind; Icon: typeof Link; hint: string }> = [
  { kind: 'revolute', Icon: RotateCw, hint: '扉やフタ。軸のまわりに回ります' },
  { kind: 'prismatic', Icon: MoveHorizontal, hint: '引き出し。まっすぐ出入りします' },
  { kind: 'fixed', Icon: Link, hint: '取っ手など。親に貼り付けて一緒に動かします' },
];

const ICONS: Record<JointKind, typeof Link> = {
  revolute: RotateCw,
  prismatic: MoveHorizontal,
  fixed: Link,
};

export function JointPanel() {
  const project = useProjectStore((s) => s.project);
  const draft = useEditorStore((s) => s.jointDraft);
  const startDraft = useEditorStore((s) => s.startJointDraft);
  const resetPicks = useEditorStore((s) => s.resetJointDraftPicks);
  const cancelDraft = useEditorStore((s) => s.cancelJointDraft);
  const selectedJointId = useEditorStore((s) => s.selectedJointId);
  const selectJoint = useEditorStore((s) => s.selectJoint);

  const nameOf = (id: string | null): string =>
    id ? (project.parts.find((p) => p.id === id)?.name ?? '?') : '';

  const create = (): void => {
    if (!draft?.basePartId || !draft.movingPartId) return;
    const id = addJoint(draft.kind, draft.basePartId, draft.movingPartId);
    if (id) {
      selectJoint(id);
      cancelDraft();
    }
  };

  return (
    <div className="panel-content">
      <p className="eyebrow">MOTION</p>
      <h2>動くようにする</h2>
      <p className="muted">2 つの部材を結び、扉や引き出しとして動かします。</p>

      {draft ? (
        <div className="tool-block tool-block-active">
          <span className="field-label">{JOINT_KIND_LABELS[draft.kind]}を作る</span>
          <ol className="wizard">
            <li className={draft.basePartId ? 'done' : 'current'}>
              <span className="wizard-index">1</span>
              {draft.basePartId ? `固定側: ${nameOf(draft.basePartId)}` : '固定側の部材をクリック'}
            </li>
            <li className={draft.movingPartId ? 'done' : draft.basePartId ? 'current' : ''}>
              <span className="wizard-index">2</span>
              {draft.movingPartId ? `動く側: ${nameOf(draft.movingPartId)}` : '動く側の部材をクリック'}
            </li>
          </ol>
          <div className="button-row">
            <button
              type="button"
              className="btn-primary"
              disabled={!draft.basePartId || !draft.movingPartId}
              onClick={create}
            >
              作成
            </button>
            <button type="button" onClick={resetPicks} disabled={!draft.basePartId}>
              選び直す
            </button>
            <button type="button" onClick={cancelDraft} title="やめる (Esc)">
              <X size={15} aria-hidden />
              やめる
            </button>
          </div>
        </div>
      ) : (
        <div className="field-group">
          <span className="field-label">可動を追加</span>
          {KINDS.map(({ kind, Icon, hint }) => (
            <button key={kind} type="button" className="kind-btn" onClick={() => startDraft(kind)}>
              <Icon size={16} aria-hidden />
              <span className="kind-label">
                {JOINT_KIND_LABELS[kind]}
                <span className="muted">{hint}</span>
              </span>
            </button>
          ))}
          {project.parts.length < 2 ? <p className="muted">部材が 2 つ以上必要です</p> : null}
        </div>
      )}

      <div className="field-group">
        <span className="field-label">この設計の可動 ({project.joints.length})</span>
        {project.joints.length === 0 ? (
          <p className="muted">まだ可動はありません</p>
        ) : (
          <ul className="op-list">
            {project.joints.map((joint) => {
              const Icon = ICONS[joint.kind];
              return (
                <li
                  key={joint.id}
                  className={`op-row${selectedJointId === joint.id ? ' op-row-active' : ''}${joint.enabled ? '' : ' op-row-disabled'}`}
                >
                  <button type="button" className="op-select" onClick={() => selectJoint(joint.id)}>
                    <Icon size={14} aria-hidden />
                    <span className="op-label">
                      {joint.name}
                      <span className="muted">
                        {nameOf(joint.basePartId)} / {nameOf(joint.movingPartId)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="削除"
                    aria-label="削除"
                    onClick={() => {
                      removeJoint(joint.id);
                      if (selectedJointId === joint.id) selectJoint(null);
                    }}
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

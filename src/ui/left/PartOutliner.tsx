import { Box, Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import { setPartLocked, setPartVisible } from '../../store/commands/partCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

export function PartOutliner() {
  const parts = useProjectStore((s) => s.project.parts);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const setHovered = useEditorStore((s) => s.setHovered);
  const jointDraft = useEditorStore((s) => s.jointDraft);
  const pickJointPart = useEditorStore((s) => s.pickJointPart);

  return (
    <div className="outliner">
      <div className="section-heading">
        <Box size={14} aria-hidden />
        部材一覧
        <span className="count">{parts.length}</span>
      </div>
      {parts.length === 0 ? (
        <p className="empty-text">まだ部材がありません</p>
      ) : (
        <ul className="outliner-list">
          {parts.map((part) => (
            <li
              key={part.id}
              className={`outliner-row${selectedIds.includes(part.id) ? ' active' : ''}`}
              onMouseEnter={() => setHovered(part.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                type="button"
                className="outliner-name"
                onClick={(event) => {
                  // 可動の追加中は、一覧からも固定側 / 動く側を選べるようにする
                  if (jointDraft) {
                    pickJointPart(part.id);
                    return;
                  }
                  if (event.shiftKey) toggleSelect(part.id);
                  else select([part.id]);
                }}
              >
                {part.name}
                <span className="outliner-size">
                  {part.size.x}x{part.size.y}x{part.size.z}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn"
                title={part.visible ? '非表示にする' : '表示する'}
                aria-label={part.visible ? '非表示にする' : '表示する'}
                onClick={() => setPartVisible(part.id, !part.visible)}
              >
                {part.visible ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
              </button>
              <button
                type="button"
                className="icon-btn"
                title={part.locked ? 'ロックを解除' : 'ロックする'}
                aria-label={part.locked ? 'ロックを解除' : 'ロックする'}
                onClick={() => setPartLocked(part.id, !part.locked)}
              >
                {part.locked ? <Lock size={14} aria-hidden /> : <LockOpen size={14} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

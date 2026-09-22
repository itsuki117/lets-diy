import { useEditorStore } from '../../store/useEditorStore';
import { hasUnsavedChanges, lastLabel, useProjectStore } from '../../store/useProjectStore';

export function StatusBar() {
  const selectedCount = useEditorStore((s) => s.selectedIds.length);
  const snap = useEditorStore((s) => s.snap);
  const partCount = useProjectStore((s) => s.project.parts.length);
  const previous = useProjectStore(lastLabel);
  const unsaved = useProjectStore(hasUnsavedChanges);

  return (
    <footer className="statusbar">
      <span className={`status-dot${unsaved ? ' status-dot-dirty' : ''}`} />
      {unsaved ? '未保存の変更があります' : '保存済み'}
      <span className="status-separator" />
      選択 {selectedCount} / {partCount}
      <span className="status-separator" />
      グリッド {snap.grid > 0 ? `${snap.grid}mm` : 'OFF'}
      <span className="status-separator" />
      角度 {snap.angle > 0 ? `${snap.angle}°` : 'OFF'}
      <span className="status-spacer" />
      {previous ? `最後の操作: ${previous}` : '操作履歴なし'}
      <span className="status-separator" />
      単位 mm
    </footer>
  );
}

import { Redo2, Undo2 } from 'lucide-react';
import { canRedo, canUndo, lastLabel, nextLabel, useProjectStore } from '../../store/useProjectStore';

export function UndoRedoButtons() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const undoable = useProjectStore(canUndo);
  const redoable = useProjectStore(canRedo);
  const previous = useProjectStore(lastLabel);
  const next = useProjectStore(nextLabel);

  return (
    <div className="topbar-group">
      <button
        type="button"
        className="icon-btn"
        disabled={!undoable}
        title={undoable ? `元に戻す: ${previous} (Ctrl+Z)` : '元に戻す (Ctrl+Z)'}
        aria-label="元に戻す"
        onClick={undo}
      >
        <Undo2 size={16} aria-hidden />
      </button>
      <button
        type="button"
        className="icon-btn"
        disabled={!redoable}
        title={redoable ? `やり直す: ${next} (Ctrl+Y)` : 'やり直す (Ctrl+Y)'}
        aria-label="やり直す"
        onClick={redo}
      >
        <Redo2 size={16} aria-hidden />
      </button>
    </div>
  );
}

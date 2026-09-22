import { useState } from 'react';
import { Download, FilePlus2, FolderOpen, Hammer, Save, Upload } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useProjectIo } from '../hooks/useProjectIo';
import { UndoRedoButtons } from './UndoRedoButtons';

export function TopBar() {
  const name = useProjectStore((s) => s.project.name);
  const applyCommand = useProjectStore((s) => s.applyCommand);
  const viewOptions = useEditorStore((s) => s.viewOptions);
  const setViewOption = useEditorStore((s) => s.setViewOption);
  const io = useProjectIo();
  const [editingName, setEditingName] = useState(false);

  return (
    <header className="topbar">
      <div className="brand">
        <Hammer size={21} aria-hidden />
        <strong>
          Let&apos;s DIY<span className="brand-dot">.</span>
        </strong>
      </div>

      <div className="topbar-group">
        <button type="button" onClick={io.newProject} title="新規プロジェクト">
          <FilePlus2 size={15} aria-hidden />
          新規
        </button>
        <button type="button" onClick={io.openFromFile} title="ファイルから読み込む">
          <Upload size={15} aria-hidden />
          読込
        </button>
        <button type="button" onClick={io.saveToBrowser} title="ブラウザに保存 (Ctrl+S)">
          <Save size={15} aria-hidden />
          保存
        </button>
        <button type="button" onClick={io.downloadFile} title="JSON ファイルとして書き出す">
          <Download size={15} aria-hidden />
          書出
        </button>
      </div>

      <UndoRedoButtons />

      <div className="topbar-group">
        <label className="toggle">
          <input
            type="checkbox"
            checked={viewOptions.grid}
            onChange={(event) => setViewOption('grid', event.target.checked)}
          />
          グリッド
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={viewOptions.shadows}
            onChange={(event) => setViewOption('shadows', event.target.checked)}
          />
          影
        </label>
      </div>

      <div className="topbar-title">
        <FolderOpen size={14} aria-hidden />
        {editingName ? (
          <input
            autoFocus
            defaultValue={name}
            aria-label="プロジェクト名"
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next && next !== name) applyCommand('プロジェクト名を変更', (draft) => { draft.name = next; });
              setEditingName(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setEditingName(false);
            }}
          />
        ) : (
          <button type="button" className="link-btn" title="名前を変更" onClick={() => setEditingName(true)}>
            {name}
          </button>
        )}
      </div>
    </header>
  );
}

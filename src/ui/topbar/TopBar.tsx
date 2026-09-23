import { useState } from 'react';
import { ClipboardList, FilePlus2, FolderOpen, Hammer, Play, Save, ScanSearch, Upload } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { findInterferences } from '../../core/collision/interference';
import { useProjectIo } from '../hooks/useProjectIo';
import { UndoRedoButtons } from './UndoRedoButtons';
import { ProjectLibrary } from './ProjectLibrary';
import { ExportMenu } from './ExportMenu';

export function TopBar({ onExportStl }: { onExportStl: (selectedOnly: boolean) => void }) {
  const name = useProjectStore((s) => s.project.name);
  const applyCommand = useProjectStore((s) => s.applyCommand);
  const viewOptions = useEditorStore((s) => s.viewOptions);
  const setViewOption = useEditorStore((s) => s.setViewOption);
  const setBomOpen = useEditorStore((s) => s.setBomOpen);
  const setInterference = useEditorStore((s) => s.setInterference);
  const setWorkspace = useEditorStore((s) => s.setWorkspace);
  const io = useProjectIo();
  const [editingName, setEditingName] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

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
        <button type="button" onClick={io.downloadFile} title="JSON ファイルに保存 (Ctrl+S)">
          <Save size={15} aria-hidden />
          保存
        </button>
        <button type="button" onClick={() => setLibraryOpen(true)} title="ブラウザの保存一覧を開く">
          <FolderOpen size={16} aria-hidden />
          保存一覧
        </button>
        <ExportMenu onExportStl={onExportStl} />
      </div>

      <div className="topbar-group">
        <button type="button" className="motion-check-button" onClick={() => setWorkspace('motionCheck')} title="作品を実際に動かして確認する">
          <Play size={15} aria-hidden />
          動作確認
        </button>
        <button type="button" onClick={() => setBomOpen(true)} title="部品表を開く">
          <ClipboardList size={15} aria-hidden />
          部品表
        </button>
        <button
          type="button"
          onClick={() => setInterference(findInterferences(useProjectStore.getState().project.parts))}
          title="部材どうしの食い込みを調べる"
        >
          <ScanSearch size={15} aria-hidden />
          干渉
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
      {libraryOpen ? <ProjectLibrary onClose={() => setLibraryOpen(false)} /> : null}
    </header>
  );
}

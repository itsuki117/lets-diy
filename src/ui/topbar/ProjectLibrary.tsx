import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Save, Trash2, X } from 'lucide-react';
import { fromDocument, toDocument } from '../../core/project/serialize';
import { getRepository } from '../../io/LocalStorageRepository';
import type { ProjectSummary } from '../../io/ProjectRepository';
import { hasUnsavedChanges, useProjectStore } from '../../store/useProjectStore';
import { useEditorStore } from '../../store/useEditorStore';

export function ProjectLibrary({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const name = useProjectStore((s) => s.project.name);

  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    void getRepository().list().then((rows) => {
      if (active) setProjects(rows);
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : '一覧を読み込めませんでした');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError('');
    try { await work(); }
    catch (err) { setError(err instanceof Error ? err.message : '保存操作に失敗しました'); }
    finally { setBusy(false); }
  };

  return (
    <dialog ref={dialog} className="project-library" aria-labelledby="library-title" onCancel={onClose} onKeyDown={(event) => event.stopPropagation()}>
      <div className="library-heading">
        <h2 id="library-title">ブラウザの保存一覧</h2>
        <button type="button" aria-label="保存一覧を閉じる" title="閉じる" onClick={onClose}><X size={16} aria-hidden /></button>
      </div>
      <p className="muted">このブラウザに保存されます。大切な設計は「保存」で JSON ファイルも保管してください。</p>
      <button type="button" disabled={busy} onClick={() => void run(async () => {
        const project = useProjectStore.getState().project;
        await getRepository().save(toDocument(project));
        useProjectStore.getState().markSaved(project);
        setProjects(await getRepository().list());
        useEditorStore.getState().pushToast('success', `「${project.name}」をブラウザに保存しました`);
      })}><Save size={16} aria-hidden />「{name}」をブラウザに保存</button>
      {error ? <p role="alert" className="notice notice-error">{error}</p> : null}
      <div className="library-list" aria-busy={busy}>
        {busy ? <p role="status">読み込み中です</p> : null}
        {!busy && !error && projects.length === 0 ? <p className="muted">保存されたプロジェクトはありません</p> : null}
        {projects.map((project) => (
          <div className="library-row" key={project.id}>
            <div><strong>{project.name}</strong><p className="muted">部材 {project.partCount} 件 / {new Date(project.savedAt).toLocaleString('ja-JP')}</p></div>
            <button type="button" disabled={busy} aria-label={`「${project.name}」を開く`} onClick={() => void run(async () => {
              if (hasUnsavedChanges(useProjectStore.getState()) && !window.confirm('保存していない変更を破棄して開きますか？')) return;
              const result = fromDocument(await getRepository().load(project.id));
              if (!result.ok) throw result.error;
              useProjectStore.getState().loadProject(result.value);
              useEditorStore.getState().pushToast('success', `「${result.value.name}」を開きました`);
              onClose();
            })}><FolderOpen size={16} aria-hidden />開く</button>
            <button type="button" disabled={busy} title={`「${project.name}」を削除`} aria-label={`「${project.name}」を削除`} onClick={() => {
              if (!window.confirm(`「${project.name}」のブラウザ保存を削除しますか？この操作は取り消せません。開いている設計や JSON ファイルは残ります。`)) return;
              void run(async () => { await getRepository().remove(project.id); setProjects(await getRepository().list()); });
            }}><Trash2 size={16} aria-hidden /></button>
          </div>
        ))}
      </div>
      <div className="button-row"><button type="button" onClick={onClose}>閉じる</button></div>
    </dialog>
  );
}

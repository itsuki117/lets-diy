import type { ProjectDocument } from '../core/types';

const safeFileName = (name: string): string =>
  (name.trim() || 'project').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);

/** 設計データを .ldiy.json として書き出す。人が読めるよう整形する。 */
export function downloadProjectJson(doc: ProjectDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(doc.project.name)}.ldiy.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

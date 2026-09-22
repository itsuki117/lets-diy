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
  // The browser may start reading the blob after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 任意のテキストをファイルとして書き出す（部品表 CSV など） */
export function downloadText(text: string, fileName: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

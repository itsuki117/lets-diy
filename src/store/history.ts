import { enablePatches, type Patch } from 'immer';

enablePatches();

export interface HistoryEntry {
  /** UI 表示用のラベル。例: 「丸穴を追加」 */
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
  at: number;
}

export const trimHistory = (entries: HistoryEntry[], limit: number): HistoryEntry[] =>
  entries.length <= limit ? entries : entries.slice(entries.length - limit);

import { AppError } from '../core/result';
import { fromDocument } from '../core/project/serialize';
import { SCHEMA_VERSION, type ProjectDocument, type ProjectId } from '../core/types';
import type { ProjectRepository, ProjectSummary } from './ProjectRepository';

const PREFIX = 'letsdiy.';
export const KEYS = {
  schemaVersion: `${PREFIX}schemaVersion`,
  autosave: `${PREFIX}autosave`,
  index: `${PREFIX}projects.index`,
  project: (id: ProjectId) => `${PREFIX}projects.${id}`,
  editorPrefs: `${PREFIX}editorPrefs`,
};

function storage(): Storage {
  try {
    if (typeof localStorage === 'undefined') throw new Error('no localStorage');
    return localStorage;
  } catch (error) {
    throw new AppError('STORAGE_UNAVAILABLE', 'このブラウザでは保存機能を利用できません', error);
  }
}

function write(key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') {
      throw new AppError('STORAGE_UNAVAILABLE', 'ブラウザの保存機能を利用できません。JSON を書き出してください', error);
    }
    throw new AppError('STORAGE_QUOTA', '保存できませんでした。不要なプロジェクトを削除してください', error);
  }
}

const readJson = <T>(key: string): T | null => {
  const raw = storage().getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

function readIndex(): ProjectSummary[] {
  const raw = storage().getItem(KEYS.index);
  if (!raw) return [];
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || !entries.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.savedAt === 'string'
        && typeof row.partCount === 'number' && Number.isInteger(row.partCount) && row.partCount >= 0;
    })) throw new Error('Invalid index');
    return entries as ProjectSummary[];
  } catch (error) {
    throw new AppError('PARSE_FAILED', '保存一覧が壊れています。既存データは変更していません。JSON ファイルをご利用ください', error);
  }
}

export class LocalStorageRepository implements ProjectRepository {
  async list(): Promise<ProjectSummary[]> {
    return readIndex();
  }

  async load(id: ProjectId): Promise<ProjectDocument> {
    const doc = readJson<ProjectDocument>(KEYS.project(id));
    if (!doc) throw new AppError('PARSE_FAILED', '保存されたプロジェクトが見つかりません');
    const parsed = fromDocument(doc);
    if (!parsed.ok) throw parsed.error;
    return { ...doc, schemaVersion: SCHEMA_VERSION, project: parsed.value };
  }

  async save(doc: ProjectDocument): Promise<void> {
    const index = readIndex();
    const summary: ProjectSummary = {
      id: doc.project.id,
      name: doc.project.name,
      savedAt: doc.savedAt,
      partCount: doc.project.parts.length,
    };
    const key = KEYS.project(doc.project.id);
    const previous = storage().getItem(key);
    write(KEYS.schemaVersion, String(SCHEMA_VERSION));
    write(key, JSON.stringify(doc));
    try {
      write(KEYS.index, JSON.stringify([summary, ...index.filter((s) => s.id !== summary.id)]));
    } catch (error) {
      if (previous === null) storage().removeItem(key);
      else write(key, previous);
      throw error;
    }
  }

  async remove(id: ProjectId): Promise<void> {
    const index = readIndex();
    write(KEYS.index, JSON.stringify(index.filter((s) => s.id !== id)));
    try {
      storage().removeItem(KEYS.project(id));
    } catch (error) {
      write(KEYS.index, JSON.stringify(index));
      throw error;
    }
  }
}

export function readAutosave(): unknown | null {
  try {
    return readJson<unknown>(KEYS.autosave);
  } catch {
    return null;
  }
}

export function writeAutosave(doc: ProjectDocument): void {
  write(KEYS.autosave, JSON.stringify(doc));
}

export function clearAutosave(): void {
  try {
    storage().removeItem(KEYS.autosave);
  } catch {
    // 保存不可の環境では何もしない
  }
}

export function readEditorPrefs<T>(): T | null {
  try {
    return readJson<T>(KEYS.editorPrefs);
  } catch {
    return null;
  }
}

export function writeEditorPrefs(value: unknown): void {
  try {
    write(KEYS.editorPrefs, JSON.stringify(value));
  } catch {
    // 設定の保存失敗は致命的ではない
  }
}

let repository: ProjectRepository | null = null;
export function getRepository(): ProjectRepository {
  repository ??= new LocalStorageRepository();
  return repository;
}

import { AppError } from '../core/result';
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

export class LocalStorageRepository implements ProjectRepository {
  async list(): Promise<ProjectSummary[]> {
    return readJson<ProjectSummary[]>(KEYS.index) ?? [];
  }

  async load(id: ProjectId): Promise<ProjectDocument> {
    const doc = readJson<ProjectDocument>(KEYS.project(id));
    if (!doc) throw new AppError('PARSE_FAILED', '保存されたプロジェクトが見つかりません');
    return doc;
  }

  async save(doc: ProjectDocument): Promise<void> {
    write(KEYS.schemaVersion, String(SCHEMA_VERSION));
    write(KEYS.project(doc.project.id), JSON.stringify(doc));
    const index = await this.list();
    const summary: ProjectSummary = {
      id: doc.project.id,
      name: doc.project.name,
      savedAt: doc.savedAt,
      partCount: doc.project.parts.length,
    };
    write(KEYS.index, JSON.stringify([summary, ...index.filter((s) => s.id !== summary.id)]));
  }

  async remove(id: ProjectId): Promise<void> {
    storage().removeItem(KEYS.project(id));
    const index = await this.list();
    write(KEYS.index, JSON.stringify(index.filter((s) => s.id !== id)));
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

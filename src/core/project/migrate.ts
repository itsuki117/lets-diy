import { AppError } from '../result';
import { SCHEMA_VERSION } from '../types';

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** v(n) -> v(n+1) の変換（設計書 §16.3） */
const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: アーチ切り欠き（type: 'arch'）を追加した。
  // 既存の加工データはそのまま読めるので、変換は不要。
  1: (doc) => doc,
  // v2 -> v3: 角丸（type: 'roundCorner'）を追加した。同じく変換は不要。
  2: (doc) => doc,
  // v3 -> v4: 可動（joints）と金物（hardware / gasSprings）を追加した。
  // ここまでの恒等変換と違い、実際に変換が要る最初の migration。
  // 配列を足さないと zod 検証で落ちる。
  3: (doc) => {
    const project = (doc.project ?? {}) as Record<string, unknown>;
    return {
      ...doc,
      project: {
        ...project,
        joints: project.joints ?? [],
        hardware: project.hardware ?? [],
        gasSprings: project.gasSprings ?? [],
      },
    };
  },
};

export function migrate(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) {
    throw new AppError('SCHEMA_INVALID', 'ファイルの形式が正しくありません');
  }
  let doc = raw as Record<string, unknown>;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;

  if (version > SCHEMA_VERSION) {
    throw new AppError('UNSUPPORTED_VERSION', 'このファイルは新しいバージョンで作成されています');
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new AppError('MIGRATION_MISSING', `バージョン ${version} のファイルは読み込めません`);
    }
    doc = step(doc);
    version += 1;
    doc.schemaVersion = version;
  }
  return doc;
}

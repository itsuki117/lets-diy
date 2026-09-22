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

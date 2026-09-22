import { describe, expect, it } from 'vitest';
import { migrate } from '../project/migrate';
import { AppError } from '../result';
import { SCHEMA_VERSION } from '../types';

describe('migrate', () => {
  it('現行バージョンは素通し', () => {
    const doc = { schemaVersion: SCHEMA_VERSION, app: 'lets-diy' };
    expect(migrate(doc)).toEqual(doc);
  });

  it('未来のバージョンは UNSUPPORTED_VERSION', () => {
    expect(() => migrate({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(AppError);
    try {
      migrate({ schemaVersion: SCHEMA_VERSION + 1 });
    } catch (error) {
      expect((error as AppError).code).toBe('UNSUPPORTED_VERSION');
    }
  });

  it('変換手順がない古いバージョンは MIGRATION_MISSING', () => {
    try {
      migrate({ schemaVersion: 0 });
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).code).toBe('MIGRATION_MISSING');
    }
  });

  it('オブジェクトでなければ SCHEMA_INVALID', () => {
    try {
      migrate('文字列');
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).code).toBe('SCHEMA_INVALID');
    }
  });
});

describe('migrate: 版上げ（アーチ切り欠き / 角丸の追加）', () => {
  it('v1 のファイルは変換を通って現行バージョンになる', () => {
    const v1 = { app: 'lets-diy', schemaVersion: 1, savedAt: '2026-09-22T00:00:00.000Z', project: { parts: [] } };
    const out = migrate(v1);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    // 加工データの変換は不要なので中身は変わらない
    expect(out.project).toEqual({ parts: [] });
  });

  it('v2 のファイルも現行バージョンになる', () => {
    const v2 = { app: 'lets-diy', schemaVersion: 2, savedAt: '2026-09-22T00:00:00.000Z', project: { parts: [] } };
    expect(migrate(v2).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('現行バージョンは 3', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });
});

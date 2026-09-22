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

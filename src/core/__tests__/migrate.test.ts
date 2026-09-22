import { describe, expect, it } from 'vitest';
import { migrate } from '../project/migrate';
import { AppError } from '../result';
import { SCHEMA_VERSION } from '../types';

const docAt = (version: number, project: Record<string, unknown> = { parts: [] }) => ({
  app: 'lets-diy',
  schemaVersion: version,
  savedAt: '2026-09-20T00:00:00.000Z',
  project,
});

describe('migrate', () => {
  it('現行バージョンは素通し', () => {
    const doc = docAt(SCHEMA_VERSION, { parts: [], joints: [], hardware: [], gasSprings: [] });
    expect(migrate(doc)).toEqual(doc);
  });

  it('未来のバージョンは UNSUPPORTED_VERSION', () => {
    expect(() => migrate(docAt(SCHEMA_VERSION + 1))).toThrow(AppError);
    try {
      migrate(docAt(SCHEMA_VERSION + 1));
    } catch (error) {
      expect((error as AppError).code).toBe('UNSUPPORTED_VERSION');
    }
  });

  it('変換手順がない古いバージョンは MIGRATION_MISSING', () => {
    try {
      migrate(docAt(0));
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

describe('migrate: v1 / v2 / v3 から v4 へ', () => {
  it('現行バージョンは 4', () => {
    expect(SCHEMA_VERSION).toBe(4);
  });

  it.each([1, 2, 3])('v%i のファイルが現行バージョンになる', (version) => {
    const out = migrate(docAt(version));
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it.each([1, 2, 3])('v%i から変換すると可動・金物の配列が空で足される', (version) => {
    const out = migrate(docAt(version)) as { project: Record<string, unknown> };
    expect(out.project.joints).toEqual([]);
    expect(out.project.hardware).toEqual([]);
    expect(out.project.gasSprings).toEqual([]);
  });

  it('既存の parts は変換で壊れない', () => {
    const parts = [{ id: 'part-1', name: 'A' }];
    const out = migrate(docAt(1, { parts })) as { project: { parts: unknown } };
    expect(out.project.parts).toEqual(parts);
  });

  it('すでに配列を持っている v3 ファイルは上書きしない', () => {
    const joints = [{ id: 'jnt-1' }];
    const out = migrate(docAt(3, { parts: [], joints })) as { project: { joints: unknown } };
    expect(out.project.joints).toEqual(joints);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseProjectJson, toDocument } from '../project/serialize';
import { SCHEMA_VERSION } from '../types';

/**
 * Ver.1 公開後の互換テスト（設計書 DESIGN_V2 §16.2）。
 *
 * ユーザーの手元には schemaVersion 1 / 2 / 3 のファイルが残っている。
 * Ver.2 以降でそれらが読めなくなっていないことを、実ファイルで固定する。
 */
const COMPAT_DIR = join(process.cwd(), 'samples', 'compat');
const load = (name: string): string => readFileSync(join(COMPAT_DIR, name), 'utf8');

const CASES = [
  { file: 'v1.ldiy.json', version: 1, minParts: 50 },
  { file: 'v2.ldiy.json', version: 2, minParts: 1 },
  { file: 'v3.ldiy.json', version: 3, minParts: 2 },
] as const;

describe('Ver.1 で保存したファイルの互換', () => {
  it.each(CASES)('$file が読み込める', ({ file, minParts }) => {
    const result = parseProjectJson(load(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parts.length).toBeGreaterThanOrEqual(minParts);
  });

  it.each(CASES)('$file は検体として期待どおりの版である', ({ file, version }) => {
    expect(JSON.parse(load(file)).schemaVersion).toBe(version);
  });

  it.each(CASES)('$file を読むと可動・金物の配列が空で入る', ({ file }) => {
    const result = parseProjectJson(load(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.joints).toEqual([]);
    expect(result.value.hardware).toEqual([]);
    expect(result.value.gasSprings).toEqual([]);
  });

  it.each(CASES)('$file は読み込み後に往復一致する', ({ file }) => {
    const first = parseProjectJson(load(file));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = parseProjectJson(JSON.stringify(toDocument(first.value)));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value).toEqual(first.value);
  });

  it('保存し直すと現行バージョンになる', () => {
    const result = parseProjectJson(load('v1.ldiy.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toDocument(result.value).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('v2 の検体はアーチ加工を含む', () => {
    const result = parseProjectJson(load('v2.ldiy.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parts.flatMap((p) => p.operations).some((o) => o.type === 'arch')).toBe(true);
  });

  it('v3 の検体は角丸加工を含む', () => {
    const result = parseProjectJson(load('v3.ldiy.json'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parts.flatMap((p) => p.operations).some((o) => o.type === 'roundCorner')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { buildBom } from '../bom/buildBom';
import { bomToCsv } from '../bom/bomCsv';
import { createProject } from '../project/createProject';
import { createOperationId } from '../ids';
import type { Operation, Part, Project } from '../types';
import { makePart } from './fixtures';

const hole = (x = 0): Operation => ({
  id: createOperationId(),
  type: 'roundHole',
  enabled: true,
  diameter: 8,
  depth: 9,
  through: true,
  position: [x, 0, 0],
  direction: '-z',
});

const project = (parts: Part[]): Project => ({ ...createProject('テスト棚'), parts });

describe('buildBom', () => {
  it('部材がなければ空', () => {
    const bom = buildBom(project([]));
    expect(bom.rows).toHaveLength(0);
    expect(bom.totalParts).toBe(0);
    expect(bom.totalAreaM2).toBe(0);
  });

  it('同じ素材寸法・同じ加工の部材はまとまる', () => {
    const a = makePart({ name: '側板 A' });
    const b = { ...makePart({ name: '側板 B' }), operations: [] };
    const bom = buildBom(project([a, b]));
    expect(bom.rows).toHaveLength(1);
    expect(bom.rows[0]!.quantity).toBe(2);
    expect(bom.rows[0]!.names).toEqual(['側板 A', '側板 B']);
  });

  it('加工が違えば別の行になる', () => {
    const a = { ...makePart({ name: 'A' }), operations: [hole(-200)] };
    const b = { ...makePart({ name: 'B' }), operations: [hole(200)] };
    const bom = buildBom(project([a, b]));
    expect(bom.rows).toHaveLength(2);
  });

  it('材質が違えば別の行になる', () => {
    const a = makePart({ name: 'A' });
    const b = { ...makePart({ name: 'B' }), material: 'pine' as const };
    expect(buildBom(project([a, b])).rows).toHaveLength(2);
  });

  it('配置が違っても同じ部品としてまとまる', () => {
    const a = makePart({ name: 'A', position: [0, 0, 0] });
    const b = makePart({ name: 'B', position: [900, 120, 40], rotation: [0, 90, 0] });
    expect(buildBom(project([a, b])).rows[0]!.quantity).toBe(2);
  });

  it('寸法は長さ・幅・厚みの順に並べ替えられる', () => {
    const part = makePart({ size: { x: 18, y: 600, z: 300 } });
    const lumber = buildBom(project([part])).rows[0]!.lumber;
    expect(lumber).toEqual({ length: 600, width: 300, thickness: 18 });
  });

  it('面積と体積を計算する', () => {
    const part = makePart({ size: { x: 1000, y: 500, z: 20 } });
    const row = buildBom(project([part])).rows[0]!;
    expect(row.faceAreaM2).toBeCloseTo(0.5, 6);
    expect(row.volumeM3).toBeCloseTo(0.01, 6);
  });

  it('加工の内訳を数える', () => {
    const part = { ...makePart(), operations: [hole(-100), hole(100)] };
    const row = buildBom(project([part])).rows[0]!;
    expect(row.operations).toEqual([{ type: 'roundHole', label: '丸穴', count: 2 }]);
  });

  it('無効な加工は数えない', () => {
    const part = { ...makePart(), operations: [{ ...hole(), enabled: false }] };
    expect(buildBom(project([part])).rows[0]!.operations).toHaveLength(0);
  });

  it('材料集計は材質と厚みでまとめる', () => {
    const a = makePart({ name: 'A', size: { x: 600, y: 300, z: 18 } });
    const b = makePart({ name: 'B', size: { x: 400, y: 200, z: 18 } });
    const c = makePart({ name: 'C', size: { x: 400, y: 200, z: 12 } });
    const bom = buildBom(project([a, b, c]));
    expect(bom.materials).toHaveLength(2);
    const t18 = bom.materials.find((m) => m.thickness === 18)!;
    expect(t18.quantity).toBe(2);
    expect(t18.areaM2).toBeCloseTo(0.18 + 0.08, 6);
  });

  it('合計が行の合計と一致する', () => {
    const parts = [makePart({ name: 'A' }), makePart({ name: 'B' }), makePart({ name: 'C', size: { x: 900, y: 200, z: 12 } })];
    const bom = buildBom(project(parts));
    expect(bom.totalParts).toBe(3);
    const sum = bom.rows.reduce((acc, r) => acc + r.faceAreaM2 * r.quantity, 0);
    expect(bom.totalAreaM2).toBeCloseTo(sum, 6);
  });
});

describe('bomToCsv', () => {
  it('見出しと明細が出る', () => {
    const csv = bomToCsv(buildBom(project([makePart({ name: '側板' })])), 'テスト棚');
    expect(csv).toContain('テスト棚');
    expect(csv).toContain('長さ(mm)');
    expect(csv).toContain('側板');
    expect(csv).toContain('材料集計');
  });

  it('Excel 向けに UTF-8 BOM を先頭に付ける', () => {
    expect(bomToCsv(buildBom(project([])), 'x').startsWith('\uFEFF')).toBe(true);
  });

  it('カンマを含む名前を引用する', () => {
    const csv = bomToCsv(buildBom(project([makePart({ name: '板,A' })])), 'p');
    expect(csv).toContain('"板,A"');
  });

  it('引用符を含む名前をエスケープする', () => {
    const csv = bomToCsv(buildBom(project([makePart({ name: '板"A' })])), 'p');
    expect(csv).toContain('"板""A"');
  });

  it('部材がなくても壊れない', () => {
    expect(() => bomToCsv(buildBom(project([])), 'p')).not.toThrow();
  });
});

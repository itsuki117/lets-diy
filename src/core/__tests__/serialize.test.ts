import { describe, expect, it } from 'vitest';
import { fromDocument, parseProjectJson, toDocument } from '../project/serialize';
import { createProject } from '../project/createProject';
import { createOperationId } from '../ids';
import { SCHEMA_VERSION, type Operation, type Project } from '../types';
import { makePart } from './fixtures';

function richProject(): Project {
  const project = createProject('テスト棚');
  const ops: Operation[] = [
    { id: createOperationId(), type: 'roundHole', enabled: true, diameter: 8, depth: 9, through: true, position: [-200, -100, 0], direction: '-z' },
    { id: createOperationId(), type: 'rectHole', enabled: true, width: 40, height: 25, depth: 9, through: false, position: [0, 0, 0], direction: '+z', rotation: 15 },
    { id: createOperationId(), type: 'notch', enabled: false, size: { x: 50, y: 40, z: 20 }, position: [275, 130, 0] },
    { id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset: 150, keep: 'negative' },
  ];
  return {
    ...project,
    parts: [{ ...makePart({ name: '側板 A' }), operations: ops }, makePart({ name: '側板 B', position: [700, 0, 0] })],
  };
}

describe('serialize', () => {
  it('Project -> Document -> Project で完全に一致する', () => {
    const project = richProject();
    const result = fromDocument(toDocument(project));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(project);
  });

  it('JSON 文字列からも復元できる', () => {
    const project = richProject();
    const result = parseProjectJson(JSON.stringify(toDocument(project)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(project);
  });

  it('schemaVersion が書き込まれる', () => {
    expect(toDocument(createProject()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('メッシュや頂点データは含まれない', () => {
    const json = JSON.stringify(toDocument(richProject()));
    expect(json).not.toMatch(/position.*Float32|vertices|geometry|indices/i);
  });
});

describe('fromDocument: 異常系', () => {
  it('壊れた JSON は PARSE_FAILED', () => {
    const result = parseProjectJson('{ not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PARSE_FAILED');
  });

  it('未来の schemaVersion は UNSUPPORTED_VERSION', () => {
    const doc = { ...toDocument(createProject()), schemaVersion: 999 };
    const result = fromDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_VERSION');
  });

  it('size が負なら SCHEMA_INVALID', () => {
    const doc = toDocument({ ...createProject(), parts: [makePart()] });
    const broken = JSON.parse(JSON.stringify(doc));
    broken.project.parts[0].size.x = -5;
    const result = fromDocument(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SCHEMA_INVALID');
  });

  it('未知の加工タイプは SCHEMA_INVALID', () => {
    const doc = toDocument({ ...createProject(), parts: [makePart()] });
    const broken = JSON.parse(JSON.stringify(doc));
    broken.project.parts[0].operations = [{ id: 'op-1', type: 'laser', enabled: true }];
    const result = fromDocument(broken);
    expect(result.ok).toBe(false);
  });

  it('部材 ID が重複していたら SCHEMA_INVALID', () => {
    const part = makePart();
    const doc = toDocument({ ...createProject(), parts: [part, { ...part }] });
    const result = fromDocument(JSON.parse(JSON.stringify(doc)));
    expect(result.ok).toBe(false);
  });

  it('必須フィールドが欠けていたら失敗する', () => {
    const doc = toDocument(createProject());
    const broken = JSON.parse(JSON.stringify(doc));
    delete broken.project.name;
    expect(fromDocument(broken).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { fromDocument, toDocument } from '../project/serialize';
import { createProject } from '../project/createProject';
import type { Joint, Project } from '../types';
import { makePart } from './fixtures';

const base = makePart({ name: '側板' });
const moving = makePart({ name: '扉', position: [400, 0, 0] });

const hinge = (over: Partial<Extract<Joint, { kind: 'revolute' }>> = {}): Joint => ({
  id: 'jnt-door0001',
  kind: 'revolute',
  name: '扉ヒンジ',
  enabled: true,
  basePartId: base.id,
  movingPartId: moving.id,
  origin: [300, 0, 0],
  axis: [0, 1, 0],
  value: 0,
  range: { min: 0, max: 110 },
  ...over,
});

const withJoints = (joints: Joint[], parts = [base, moving]): Project => ({
  ...createProject('可動テスト'),
  parts,
  joints,
});

const parse = (project: Project) => fromDocument(JSON.parse(JSON.stringify(toDocument(project))));

describe('projectSchema: joint', () => {
  it('正常な joint を読める', () => {
    const result = parse(withJoints([hinge()]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.joints).toHaveLength(1);
  });

  it('fixed joint は値を持たなくても読める', () => {
    const fixed: Joint = {
      id: 'jnt-fix00001',
      kind: 'fixed',
      name: '取っ手',
      enabled: true,
      basePartId: base.id,
      movingPartId: moving.id,
    };
    expect(parse(withJoints([fixed])).ok).toBe(true);
  });

  it('prismatic joint を読める', () => {
    const slide: Joint = {
      id: 'jnt-slide001',
      kind: 'prismatic',
      name: '引き出し',
      enabled: true,
      basePartId: base.id,
      movingPartId: moving.id,
      axis: [0, 0, 1],
      value: 0,
      range: { min: 0, max: 350 },
    };
    expect(parse(withJoints([slide])).ok).toBe(true);
  });

  it('未知の kind を拒否する', () => {
    const doc = JSON.parse(JSON.stringify(toDocument(withJoints([hinge()]))));
    doc.project.joints[0].kind = 'ballJoint';
    expect(fromDocument(doc).ok).toBe(false);
  });

  it('同じ部材どうしの結合を拒否する', () => {
    expect(parse(withJoints([hinge({ movingPartId: base.id })])).ok).toBe(false);
  });

  it('可動範囲の最小が最大を超えていたら拒否する', () => {
    expect(parse(withJoints([hinge({ range: { min: 120, max: 0 } })])).ok).toBe(false);
  });

  it('存在しない部材を指す joint を拒否する', () => {
    expect(parse(withJoints([hinge({ basePartId: 'part-nope' })])).ok).toBe(false);
  });

  it('joint の ID 重複を拒否する', () => {
    expect(parse(withJoints([hinge(), hinge()])).ok).toBe(false);
  });

  it('1 部材が 2 つの joint で動かされていたら拒否する（多重駆動）', () => {
    const third = makePart({ name: '天板', position: [0, 400, 0] });
    const a = hinge({ id: 'jnt-a0000001' });
    const b = hinge({ id: 'jnt-b0000001', basePartId: third.id });
    expect(parse(withJoints([a, b], [base, moving, third])).ok).toBe(false);
  });
});

describe('projectSchema: 金物とガススプリング', () => {
  const preset = {
    presetId: 'hinge.concealed.35',
    label: 'スライド丁番 カップ径35',
    kind: 'hinge' as const,
    partNumber: 'SH-35',
    jointKind: 'revolute' as const,
    defaultRange: { min: 0, max: 110 },
    holes: [
      {
        target: 'moving' as const,
        shape: 'round' as const,
        width: 35,
        depth: 11.5,
        through: false,
        offset: [0, 0, 0] as [number, number, number],
      },
    ],
  };

  const withHardware = (over: Record<string, unknown> = {}): Project => ({
    ...withJoints([hinge()]),
    hardware: [
      {
        id: 'hw-00000001',
        preset,
        jointId: 'jnt-door0001',
        position: [300, 0, 0],
        rotation: [0, 0, 0],
        quantity: 2,
        ...over,
      },
    ],
  });

  it('正常な金物を読める', () => {
    const result = parse(withHardware());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hardware[0]?.quantity).toBe(2);
  });

  it('jointId が null でも読める（未接続）', () => {
    expect(parse(withHardware({ jointId: null })).ok).toBe(true);
  });

  it('存在しない joint を指す金物を拒否する', () => {
    expect(parse(withHardware({ jointId: 'jnt-nope0001' })).ok).toBe(false);
  });

  it('数量 0 を拒否する', () => {
    expect(parse(withHardware({ quantity: 0 })).ok).toBe(false);
  });

  it('縮んだ長さが伸びた長さ以上のガススプリングを拒否する', () => {
    const project: Project = {
      ...withHardware(),
      gasSprings: [
        {
          id: 'gas-0000001',
          hardwareId: 'hw-00000001',
          jointId: 'jnt-door0001',
          baseAnchor: [0, 0, 0],
          movingAnchor: [0, 0, 0],
          strokeMin: 400,
          strokeMax: 250,
          forceN: 100,
        },
      ],
    };
    expect(parse(project).ok).toBe(false);
  });
});

describe('serialize: 可動を含む往復', () => {
  it('joint と金物を含むプロジェクトが往復一致する', () => {
    const project: Project = {
      ...withJoints([hinge()]),
      hardware: [
        {
          id: 'hw-00000001',
          preset: {
            presetId: 'hinge.concealed.35',
            label: 'スライド丁番',
            kind: 'hinge',
            jointKind: 'revolute',
            holes: [],
          },
          jointId: 'jnt-door0001',
          position: [300, 0, 0],
          rotation: [0, 0, 0],
          quantity: 2,
        },
      ],
    };
    const result = parse(project);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(project);
  });

  it('新規プロジェクトは 3 つの配列が空', () => {
    const project = createProject();
    expect(project.joints).toEqual([]);
    expect(project.hardware).toEqual([]);
    expect(project.gasSprings).toEqual([]);
  });
});

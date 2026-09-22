import { describe, expect, it } from 'vitest';
import { applyPoses, canEditRestPose, isDrivenPart, solvePoses } from '../motion/kinematics';
import { canAddJoint, validateJoints } from '../motion/jointValidate';
import { defaultJoint } from '../motion/jointDefaults';
import { createProject } from '../project/createProject';
import type { Joint, Part, Project, Vec3 } from '../types';
import { makePart } from './fixtures';

const close = (a: Vec3, b: Vec3, digits = 5): void => {
  expect(a[0]).toBeCloseTo(b[0], digits);
  expect(a[1]).toBeCloseTo(b[1], digits);
  expect(a[2]).toBeCloseTo(b[2], digits);
};

const project = (parts: Part[], joints: Joint[] = []): Project => ({
  ...createProject('運動学テスト'),
  parts,
  joints,
});

type Revolute = Extract<Joint, { kind: 'revolute' }>;
type Prismatic = Extract<Joint, { kind: 'prismatic' }>;

let seq = 0;
const nextId = (): string => `jnt-${(seq += 1).toString().padStart(8, '0')}`;

const revolute = (base: Part, moving: Part, over: Partial<Revolute> = {}): Joint => ({
  id: nextId(),
  kind: 'revolute',
  name: 'ヒンジ',
  enabled: true,
  basePartId: base.id,
  movingPartId: moving.id,
  origin: [0, 0, 0],
  axis: [0, 1, 0],
  value: 0,
  range: { min: -180, max: 180 },
  ...over,
});

const prismatic = (base: Part, moving: Part, over: Partial<Prismatic> = {}): Joint => ({
  id: nextId(),
  kind: 'prismatic',
  name: 'スライド',
  enabled: true,
  basePartId: base.id,
  movingPartId: moving.id,
  axis: [0, 0, 1],
  value: 0,
  range: { min: 0, max: 500 },
  ...over,
});

const fixed = (base: Part, moving: Part): Joint => ({
  id: nextId(),
  kind: 'fixed',
  name: '固定',
  enabled: true,
  basePartId: base.id,
  movingPartId: moving.id,
});

describe('solvePoses: 値 0 なら rest pose', () => {
  it('joint ありなし混在の 5 部材で完全一致する', () => {
    const a = makePart({ name: 'A', position: [0, 0, 0] });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const c = makePart({ name: 'C', position: [0, 200, 0], rotation: [0, 45, 0] });
    const d = makePart({ name: 'D', position: [-300, 50, 20] });
    const e = makePart({ name: 'E', position: [10, 10, 10], rotation: [15, 30, 45] });
    const result = solvePoses(project([a, b, c, d, e], [revolute(a, b), fixed(a, c)]));

    for (const part of [a, b, c, d, e]) {
      const pose = result.poses.get(part.id)!;
      close(pose.position, part.transform.position);
      close(pose.rotation, part.transform.rotation, 4);
    }
    expect(result.problems).toEqual([]);
  });
});

describe('solvePoses: revolute', () => {
  it('原点 [0,0,0]・軸 Y で 90 度回すと +X が -Z へ移る', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'moving', position: [100, 0, 0] });
    const result = solvePoses(project([base, moving], [revolute(base, moving, { value: 90 })]));
    const pose = result.poses.get(moving.id)!;
    close(pose.position, [0, 0, -100]);
    close(pose.rotation, [0, 90, 0], 4);
  });

  it('原点を端にずらすと、その点を中心に回る（実際の扉の蝶番）', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'door', position: [100, 0, 0] });
    const result = solvePoses(
      project([base, moving], [revolute(base, moving, { origin: [50, 0, 0], value: 90 })]),
    );
    close(result.poses.get(moving.id)!.position, [50, 0, -50]);
  });

  it('軸が単位ベクトルでなくても正規化される', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'moving', position: [100, 0, 0] });
    const unit = solvePoses(project([base, moving], [revolute(base, moving, { axis: [0, 1, 0], value: 90 })]));
    const scaled = solvePoses(project([base, moving], [revolute(base, moving, { axis: [0, 7, 0], value: 90 })]));
    close(unit.poses.get(moving.id)!.position, scaled.poses.get(moving.id)!.position);
  });

  it('負の角度でも動く', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'moving', position: [100, 0, 0] });
    const result = solvePoses(project([base, moving], [revolute(base, moving, { value: -90 })]));
    close(result.poses.get(moving.id)!.position, [0, 0, 100]);
  });

  it('180 度で反対側へ回る', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'moving', position: [100, 0, 0] });
    const result = solvePoses(project([base, moving], [revolute(base, moving, { value: 180 })]));
    close(result.poses.get(moving.id)!.position, [-100, 0, 0]);
  });

  it('固定側が回っていても、値 0 なら rest pose のまま', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0], rotation: [0, 90, 0] });
    const moving = makePart({ name: 'moving', position: [100, 0, 0] });
    const rest = solvePoses(project([base, moving], [revolute(base, moving)]));
    close(rest.poses.get(moving.id)!.position, [100, 0, 0]);
  });
});

describe('solvePoses: prismatic', () => {
  it('軸方向へ value mm だけ動く', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'drawer', position: [0, 0, 0] });
    const result = solvePoses(project([base, moving], [prismatic(base, moving, { value: 250 })]));
    close(result.poses.get(moving.id)!.position, [0, 0, 250]);
  });

  it('軸が正規化される', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'drawer', position: [0, 0, 0] });
    const result = solvePoses(
      project([base, moving], [prismatic(base, moving, { axis: [0, 0, 5], value: 100 })]),
    );
    close(result.poses.get(moving.id)!.position, [0, 0, 100]);
  });

  it('姿勢は変わらない', () => {
    const base = makePart({ name: 'base', position: [0, 0, 0] });
    const moving = makePart({ name: 'drawer', position: [0, 0, 0], rotation: [0, 30, 0] });
    const result = solvePoses(project([base, moving], [prismatic(base, moving, { value: 100 })]));
    close(result.poses.get(moving.id)!.rotation, [0, 30, 0], 4);
  });
});

describe('solvePoses: fixed', () => {
  it('親を動かすと子が同じだけ動く', () => {
    const root = makePart({ name: 'root', position: [0, 0, 0] });
    const door = makePart({ name: 'door', position: [100, 0, 0] });
    const handle = makePart({ name: 'handle', position: [180, 0, 0] });
    const joints = [revolute(root, door, { value: 90 }), fixed(door, handle)];
    const result = solvePoses(project([root, door, handle], joints));
    close(result.poses.get(door.id)!.position, [0, 0, -100]);
    close(result.poses.get(handle.id)!.position, [0, 0, -180]);
    close(result.poses.get(handle.id)!.rotation, [0, 90, 0], 4);
  });
});

describe('solvePoses: 多段の伝播', () => {
  it('本体 - 引き出し - 前板 の 3 段で伝播する', () => {
    const body = makePart({ name: 'body', position: [0, 0, 0] });
    const drawer = makePart({ name: 'drawer', position: [0, 0, 0] });
    const front = makePart({ name: 'front', position: [0, 0, 50] });
    const joints = [prismatic(body, drawer, { value: 200 }), fixed(drawer, front)];
    const result = solvePoses(project([body, drawer, front], joints));
    close(result.poses.get(drawer.id)!.position, [0, 0, 200]);
    close(result.poses.get(front.id)!.position, [0, 0, 250]);
  });

  it('4 段でも正しい', () => {
    const parts = [0, 1, 2, 3].map((i) => makePart({ name: `p${i}`, position: [0, 0, i * 10] }));
    const joints = [1, 2, 3].map((i) => prismatic(parts[i - 1]!, parts[i]!, { value: 5 }));
    const result = solvePoses(project(parts, joints));
    close(result.poses.get(parts[3]!.id)!.position, [0, 0, 45]);
  });
});

describe('solvePoses: 壊れた構成', () => {
  it('閉路を検出し、例外を投げない', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const result = solvePoses(project([a, b], [revolute(a, b), revolute(b, a)]));
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.poses.size).toBe(2);
  });

  it('自己参照を検出する', () => {
    const a = makePart({ name: 'A' });
    expect(validateJoints([revolute(a, a)], [a])[0]?.message).toContain('同じ部材');
  });

  it('多重駆動を検出する', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const c = makePart({ name: 'C', position: [0, 100, 0] });
    const problems = validateJoints([revolute(a, c), revolute(b, c)], [a, b, c]);
    expect(problems.some((p) => p.message.includes('複数の可動'))).toBe(true);
  });

  it('壊れた joint があっても、他の部材の pose は正しい', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const c = makePart({ name: 'C', position: [0, 0, 300] });
    const joints = [revolute(a, a), prismatic(a, c, { value: 100 })];
    const result = solvePoses(project([a, b, c], joints));
    close(result.poses.get(c.id)!.position, [0, 0, 400]);
    close(result.poses.get(b.id)!.position, [100, 0, 0]);
  });

  it('無効な joint は rest pose のまま', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const joint = { ...revolute(a, b, { value: 90 }), enabled: false };
    const result = solvePoses(project([a, b], [joint]));
    close(result.poses.get(b.id)!.position, [100, 0, 0]);
  });

  it('存在しない部材を指す joint があっても落ちない', () => {
    const a = makePart({ name: 'A' });
    const ghost = { ...revolute(a, a), movingPartId: 'part-nope' };
    const result = solvePoses(project([a], [ghost]));
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.poses.get(a.id)).toBeDefined();
  });
});

describe('canAddJoint', () => {
  it('正常な追加は通る', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    expect(canAddJoint([], revolute(a, b), [a, b]).ok).toBe(true);
  });

  it('閉路になる追加を拒否する', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const check = canAddJoint([revolute(a, b)], revolute(b, a), [a, b]);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('輪');
  });

  it('多重駆動になる追加を拒否する', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const c = makePart({ name: 'C', position: [0, 100, 0] });
    expect(canAddJoint([revolute(a, c)], revolute(b, c), [a, b, c]).ok).toBe(false);
  });

  it('同じ部材どうしを拒否する', () => {
    const a = makePart({ name: 'A' });
    expect(canAddJoint([], revolute(a, a), [a]).ok).toBe(false);
  });
});

describe('applyPoses / canEditRestPose', () => {
  it('applyPoses が pose を transform に差し込む', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const result = solvePoses(project([a, b], [revolute(a, b, { value: 90 })]));
    const posed = applyPoses([a, b], result.poses);
    close(posed[1]!.transform.position, [0, 0, -100]);
    close(b.transform.position, [100, 0, 0]);
  });

  it('値 0 の可動部材は rest pose を編集できる', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    expect(canEditRestPose([revolute(a, b, { value: 0 })], b.id)).toBe(true);
  });

  it('値が 0 でない可動部材は編集できない', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    expect(canEditRestPose([revolute(a, b, { value: 45 })], b.id)).toBe(false);
  });

  it('固定 joint の部材は常に編集できる', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    expect(canEditRestPose([fixed(a, b)], b.id)).toBe(true);
  });

  it('joint のない部材は常に編集できる', () => {
    const a = makePart({ name: 'A' });
    expect(canEditRestPose([], a.id)).toBe(true);
  });

  it('isDrivenPart が駆動している joint を返す', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [100, 0, 0] });
    const joint = revolute(a, b);
    expect(isDrivenPart([joint], b.id)?.id).toBe(joint.id);
    expect(isDrivenPart([joint], a.id)).toBeUndefined();
  });
});

describe('defaultJoint', () => {
  it('ヒンジの軸は base ローカル Y、原点は base の外形内に収まる', () => {
    const base = makePart({ name: '側板', size: { x: 300, y: 600, z: 18 }, position: [0, 300, 0] });
    const moving = makePart({ name: '扉', size: { x: 400, y: 600, z: 18 }, position: [400, 300, 150] });
    const joint = defaultJoint('revolute', base, moving);
    expect(joint.kind).toBe('revolute');
    if (joint.kind !== 'revolute') return;
    close(joint.axis, [0, 1, 0]);
    expect(Math.abs(joint.origin[0])).toBeLessThanOrEqual(150);
    expect(Math.abs(joint.origin[2])).toBeLessThanOrEqual(9);
  });

  it('スライドの軸は base から moving へ向かう主軸に丸められる', () => {
    const base = makePart({ name: '本体', position: [0, 0, 0] });
    const moving = makePart({ name: '引き出し', position: [0, 0, 400] });
    const joint = defaultJoint('prismatic', base, moving);
    if (joint.kind !== 'prismatic') return;
    close(joint.axis, [0, 0, 1]);
  });

  it('固定は値も範囲も持たない', () => {
    const base = makePart({ name: 'A' });
    const moving = makePart({ name: 'B', position: [100, 0, 0] });
    const joint = defaultJoint('fixed', base, moving);
    expect(joint.kind).toBe('fixed');
    expect('value' in joint).toBe(false);
  });

  it('既定値はそのまま検査を通る', () => {
    const base = makePart({ name: 'A' });
    const moving = makePart({ name: 'B', position: [100, 0, 0] });
    for (const kind of ['fixed', 'revolute', 'prismatic'] as const) {
      expect(validateJoints([defaultJoint(kind, base, moving)], [base, moving])).toEqual([]);
    }
  });
});

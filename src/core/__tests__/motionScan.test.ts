import { describe, expect, it } from 'vitest';
import { scanJointMotion } from '../motion/motionScan';
import { createProject } from '../project/createProject';
import type { Joint, Part, Project } from '../types';
import { makePart } from './fixtures';

/**
 * 側板（YZ 平面に立つ薄板）と扉を用意し、扉をヒンジで回して当たりを見る。
 * 扉は側板の右側に立っていて、開くと側板の方へ回り込む。
 */
const setup = (doorRange: { min: number; max: number }, doorX = 400): { project: Project; jointId: string } => {
  const side = makePart({ name: '側板', size: { x: 18, y: 600, z: 300 }, position: [0, 300, 0] });
  const door = makePart({ name: '扉', size: { x: 400, y: 600, z: 18 }, position: [doorX, 300, 150] });
  const joint: Joint = {
    id: 'jnt-door0001',
    kind: 'revolute',
    name: '扉ヒンジ',
    enabled: true,
    basePartId: side.id,
    movingPartId: door.id,
    // 側板の手前端を軸にする
    origin: [0, 0, 150],
    axis: [0, 1, 0],
    value: doorRange.min,
    range: doorRange,
  };
  return { project: { ...createProject('扉テスト'), parts: [side, door], joints: [joint] }, jointId: joint.id };
};

const farApart = (): { project: Project; jointId: string } => {
  const a = makePart({ name: 'A', size: { x: 100, y: 100, z: 18 }, position: [0, 50, 0] });
  const b = makePart({ name: 'B', size: { x: 100, y: 100, z: 18 }, position: [3000, 50, 0] });
  const joint: Joint = {
    id: 'jnt-far00001',
    kind: 'revolute',
    name: '遠い',
    enabled: true,
    basePartId: a.id,
    movingPartId: b.id,
    origin: [0, 0, 0],
    axis: [0, 1, 0],
    value: 0,
    range: { min: 0, max: 90 },
  };
  return { project: { ...createProject('離れている'), parts: [a, b], joints: [joint] }, jointId: joint.id };
};

describe('scanJointMotion', () => {
  it('どこでもぶつからなければ blocked が空で、全域が使える', () => {
    const { project, jointId } = farApart();
    const result = scanJointMotion(project, jointId, 12);
    expect(result.blocked).toEqual([]);
    expect(result.usable).toEqual({ min: 0, max: 90 });
  });

  it('途中からぶつかる構成で、使える範囲が狭まる', () => {
    // 扉が側板へ回り込むので、大きく開くとぶつかる
    const { project, jointId } = setup({ min: 0, max: 180 });
    const result = scanJointMotion(project, jointId, 36);
    expect(result.blocked.length).toBeGreaterThan(0);
    expect(result.usable).not.toBeNull();
    expect(result.usable!.min).toBe(0);
    expect(result.usable!.max).toBeLessThan(180);
  });

  it('最初からぶつかっていれば usable が null か、閉じた側から始まらない', () => {
    // 扉を側板の中へ重ねて置く
    const side = makePart({ name: '側板', size: { x: 200, y: 600, z: 300 }, position: [0, 300, 0] });
    const door = makePart({ name: '扉', size: { x: 200, y: 600, z: 300 }, position: [0, 300, 0] });
    const joint: Joint = {
      id: 'jnt-overlap1',
      kind: 'revolute',
      name: '重なり',
      enabled: true,
      basePartId: side.id,
      movingPartId: door.id,
      origin: [0, 0, 0],
      axis: [0, 1, 0],
      value: 0,
      range: { min: 0, max: 30 },
    };
    const project: Project = { ...createProject('重なり'), parts: [side, door], joints: [joint] };
    const result = scanJointMotion(project, joint.id, 6);
    expect(result.usable).toBeNull();
    expect(result.blocked.length).toBeGreaterThan(0);
  });

  it('区間には食い込んでいる組み合わせが入る', () => {
    const { project, jointId } = setup({ min: 0, max: 180 });
    const result = scanJointMotion(project, jointId, 24);
    const block = result.blocked[0]!;
    expect(block.pairs.length).toBeGreaterThan(0);
    expect(block.pairs[0]!.depthMm).toBeGreaterThan(0);
  });

  it('分割数を増やすと境界の精度が上がる', () => {
    const { project, jointId } = setup({ min: 0, max: 180 });
    const coarse = scanJointMotion(project, jointId, 6);
    const fine = scanJointMotion(project, jointId, 60);
    expect(fine.usable!.max).toBeGreaterThanOrEqual(coarse.usable!.max);
  });

  it('固定 joint は走査しない', () => {
    const a = makePart({ name: 'A' });
    const b = makePart({ name: 'B', position: [1000, 0, 0] });
    const joint: Joint = {
      id: 'jnt-fixed001',
      kind: 'fixed',
      name: '固定',
      enabled: true,
      basePartId: a.id,
      movingPartId: b.id,
    };
    const project: Project = { ...createProject('固定'), parts: [a, b], joints: [joint] };
    const result = scanJointMotion(project, joint.id);
    expect(result.steps).toBe(0);
    expect(result.usable).toBeNull();
  });

  it('存在しない joint でも落ちない', () => {
    const { project } = farApart();
    expect(() => scanJointMotion(project, 'jnt-nope')).not.toThrow();
  });

  it('非表示の部材は判定に含まれない', () => {
    const { project, jointId } = setup({ min: 0, max: 180 });
    const hidden: Project = {
      ...project,
      parts: project.parts.map((p) => (p.name === '側板' ? { ...p, visible: false } : p)),
    };
    const result = scanJointMotion(hidden, jointId, 12);
    expect(result.blocked).toEqual([]);
  });

  it('走査時間を記録する', () => {
    const { project, jointId } = farApart();
    expect(scanJointMotion(project, jointId, 6).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('分割数 0 を渡しても 1 分割として扱う', () => {
    const { project, jointId } = farApart();
    expect(scanJointMotion(project, jointId, 0).steps).toBe(1);
  });
});

describe('scanJointMotion: 性能', () => {
  it('部材 50 枚 x 36 ステップが 1 秒以内に終わる', () => {
    const parts: Part[] = Array.from({ length: 50 }, (_, i) =>
      makePart({ name: `p${i}`, size: { x: 200, y: 200, z: 18 }, position: [i * 260, 100, 0] }),
    );
    const joint: Joint = {
      id: 'jnt-perf0001',
      kind: 'revolute',
      name: '性能',
      enabled: true,
      basePartId: parts[0]!.id,
      movingPartId: parts[1]!.id,
      origin: [0, 0, 0],
      axis: [0, 1, 0],
      value: 0,
      range: { min: 0, max: 90 },
    };
    const project: Project = { ...createProject('性能'), parts, joints: [joint] };
    const result = scanJointMotion(project, joint.id, 36);
    expect(result.durationMs).toBeLessThan(1000);
  });
});

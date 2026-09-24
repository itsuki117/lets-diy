import { describe, expect, it } from 'vitest';
import { hingeLayout, railLayout, solveGasMount } from '../hardware/mechanism';
import { getHardwarePreset } from '../hardware/presets';
import { balanceCurve, buildMotionModel, type MotionModel, type MotionState } from '../motion/dynamics';
import { gasLimitedRange, gasStaticForce, resolveGasSpec } from '../motion/gasSpring';
import { createProject } from '../project/createProject';
import { makePart } from './fixtures';
import type { GasSpringMount, Project, RevoluteJoint } from '../types';

/** 高さ 400 の箱の上に、奥の縁で開くフタ（600 x 400, t18 合板） */
function lidBox(): { project: Project; joint: RevoluteJoint } {
  const back = makePart({ name: '背板', size: { x: 600, y: 400, z: 18 }, position: [0, 0, -191] });
  const side = makePart({ name: '側板', size: { x: 18, y: 400, z: 364 }, position: [-291, 0, 0] });
  const lid = makePart({ name: 'フタ', size: { x: 600, y: 18, z: 400 }, position: [0, 209, 0] });
  const layout = hingeLayout(back, lid);
  const joint: RevoluteJoint = {
    id: 'j', name: 'フタ', enabled: true, kind: 'revolute', basePartId: back.id, movingPartId: lid.id,
    origin: layout.origin, axis: layout.axis, value: 0, range: { min: 0, max: 110 },
  };
  return { project: { ...createProject(), parts: [back, side, lid], joints: [joint] }, joint };
}

function withSpring(project: Project, joint: RevoluteJoint, presetId: string, quantity = 1): Project {
  const preset = getHardwarePreset(presetId)!;
  const solved = solveGasMount(project, joint, preset.gasSpring!)!;
  const mount: GasSpringMount = {
    id: 'g', hardwareId: 'h', jointId: joint.id, baseAnchor: solved.baseAnchor, movingAnchor: solved.movingAnchor,
    ...preset.gasSpring!, rodEnd: 'moving',
  };
  return {
    ...project,
    hardware: [{ id: 'h', preset, jointId: joint.id, position: solved.baseAnchor, rotation: [0, 0, 0], quantity }],
    gasSprings: [mount],
  };
}

function release(model: MotionModel, from: number): { q: number; seconds: number } {
  let state: MotionState = { q: from, v: 0, restTime: 0, hitStop: false };
  let t = 0;
  while (t < 20 && state.restTime < 0.35) {
    state = model.step(state, 0.001);
    t += 0.001;
    expect(state.q).toBeGreaterThanOrEqual(model.limits.min - 1e-9);
    expect(state.q).toBeLessThanOrEqual(model.limits.max + 1e-9);
  }
  return { q: state.q, seconds: t };
}

describe('gas spring force', () => {
  it('rises with compression (progression) and pulls for traction type', () => {
    const push = resolveGasSpec(getHardwarePreset('gas.100n.250')!.gasSpring!);
    expect(gasStaticForce(push, 400)).toBeCloseTo(100);
    expect(gasStaticForce(push, 250)).toBeCloseTo(130);
    const traction = resolveGasSpec(getHardwarePreset('gas.traction.80n')!.gasSpring!);
    expect(gasStaticForce(traction, 250)).toBeLessThan(0);
  });
});

describe('hardware decides the motion', () => {
  it('puts a lid hinge on the rear edge so the lid lifts up', () => {
    const { project, joint } = lidBox();
    expect(joint.origin[1]).toBeCloseTo(200);
    const model = buildMotionModel(project, joint.id)!;
    // 自重で閉じる向き（負）のトルク
    expect(model.staticLoad(10).gravity).toBeLessThan(0);
  });

  it('pulls a drawer out along the rail toward the cabinet front', () => {
    const side = makePart({ size: { x: 18, y: 200, z: 400 }, position: [-259, 0, 0] });
    const drawer = makePart({ size: { x: 480, y: 150, z: 380 }, position: [0, 0, 10] });
    const layout = railLayout(side, drawer, getHardwarePreset('slide.side.350')!);
    expect(layout.axis).toEqual([0, 0, 1]);
    expect(layout.position[0]).toBeCloseTo(9);
    expect(layout.position[2]).toBeCloseTo(200 - 175);
  });

  it('cannot open beyond the gas spring full extension', () => {
    const { project, joint } = lidBox();
    const sprung = withSpring(project, joint, 'gas.50n.165');
    // 同じ取付位置で、伸びきり長さが 20mm 短いガススプリングにする
    sprung.gasSprings[0]!.strokeMax -= 20;
    const limited = gasLimitedRange(sprung, joint);
    expect(limited.max).toBeLessThan(90);
    expect(limited.min).toBe(0);
    expect(limited.maxReason).toContain('伸びきり');
  });

  it('locking gas spring freezes the lid where it is locked', () => {
    const { project, joint } = lidBox();
    const sprung = withSpring(project, joint, 'gas.lock.150n');
    sprung.gasSprings[0]!.locked = true;
    const range = gasLimitedRange(sprung, joint);
    expect(range.min).toBe(range.max);
  });
});

describe('release behaviour', () => {
  it('a bare lid falls shut', () => {
    const { project, joint } = lidBox();
    expect(release(buildMotionModel(project, joint.id)!, 80).q).toBeCloseTo(0);
  });

  it('a lift-assist spring keeps the lid shut when closed and open when opened', () => {
    const { project, joint } = lidBox();
    const sprung = withSpring(project, joint, 'gas.50n.165', 2);
    const model = buildMotionModel(sprung, joint.id)!;
    const curve = balanceCurve(model, 20);
    expect(curve[0]!.state).not.toBe('opens');
    expect(curve[curve.length - 1]!.state).not.toBe('closes');
    expect(release(model, 3).q).toBeCloseTo(model.limits.min);
    expect(release(model, model.limits.max - 5).q).toBeGreaterThan(model.limits.max - 6);
  });

  it('a damper lets the lid down slowly instead of slamming', () => {
    const { project, joint } = lidBox();
    const bare = release(buildMotionModel(project, joint.id)!, 45);
    const damped = release(buildMotionModel(withSpring(project, joint, 'damper.flap.20n', 2), joint.id)!, 45);
    expect(damped.q).toBeCloseTo(0);
    expect(damped.seconds).toBeGreaterThan(bare.seconds * 3);
  });
});

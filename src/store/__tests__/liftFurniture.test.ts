import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHardwarePreset } from '../../core/hardware/presets';
import { buildMotionModel } from '../../core/motion/dynamics';
import { motionLimits } from '../../core/motion/limits';
import { applyMat3, rotationMatrix } from '../../core/math/matrix';
import { createProject } from '../../core/project/createProject';
import { isMovableJoint, type MovableJoint } from '../../core/types';
import { addHardware, removeHardware } from '../commands/hardwareCommands';
import { simSetLatch } from '../commands/simulationCommands';
import { useSimulationStore, workingProject } from '../useSimulationStore';
import { addPart } from '../commands/partCommands';
import { useEditorStore } from '../useEditorStore';
import { useMotionPlayer } from '../useMotionPlayer';
import { useProjectStore } from '../useProjectStore';

/**
 * 利用者が作りたい家具: リニアガイドで上下する棚板を、ガススプリングで持ち上げ補助し、
 * 上端でドアロックが掛かる。棚板には天板を L 字金具で固定する。
 */

let now = 0;
let queue: Array<(t: number) => void> = [];
function runFrames(seconds: number, fps = 60): void {
  for (let i = 0; i < Math.round(seconds * fps) && queue.length > 0; i += 1) {
    now += 1000 / fps;
    const current = queue;
    queue = [];
    for (const callback of current) callback(now);
  }
}

const preset = (id: string) => getHardwarePreset(id)!;
const state = () => useProjectStore.getState().project;
const lift = (): MovableJoint => state().joints.find((joint): joint is MovableJoint => isMovableJoint(joint))!;

function build(): { frame: string; carriage: string; top: string } {
  // 背面の柱（固定）と、その手前をガイド 1 本ぶん（約 28mm）離れて上下する棚板。
  // 縮んだガススプリング（403mm）が下に収まるよう、昇降板は床から 450mm の位置から始まる
  const frame = addPart({ name: '背板', size: { x: 600, y: 1200, z: 18 }, position: [0, 600, 0] });
  const carriage = addPart({ name: '昇降板', size: { x: 500, y: 300, z: 18 }, position: [0, 600, 46] });
  const top = addPart({ name: '天板', size: { x: 500, y: 18, z: 300 }, position: [0, 759, 205] });
  return { frame, carriage, top };
}

describe('上下に動く家具（リニアガイド + ガススプリング + ドアロック + 固定金具）', () => {
  beforeEach(() => {
    now = 0;
    queue = [];
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (callback: (t: number) => void) => { queue.push(callback); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
    useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
    useEditorStore.setState({ selectedIds: [], selectedJointId: null, toasts: [] });
    useMotionPlayer.setState({ phase: 'idle', physics: true, jointId: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('リニアガイドは取付面に沿って上下に動く', () => {
    const { frame, carriage } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    const joint = lift();
    expect(joint.kind).toBe('prismatic');
    const world = applyMat3(rotationMatrix(state().parts[0]!.transform.rotation), joint.axis);
    expect(world[1]).toBeCloseTo(1);
    expect(joint.range).toEqual({ min: 0, max: 720 });
    expect(joint.value).toBe(0);
    // レールのネジは背板に、ブロックのネジは昇降板に
    const holes = (id: string) => state().parts.find((part) => part.id === id)!.operations.length;
    expect(holes(frame)).toBeGreaterThan(0);
    expect(holes(carriage)).toBe(8);
  });

  it('ガススプリングは直進にも付き、伸縮範囲が上下の範囲を決める', () => {
    const { frame, carriage } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    addHardware({ preset: preset('gas.150n.400'), basePartId: frame, movingPartId: carriage });
    // 丁番を勝手に足さない
    expect(state().hardware.map((item) => item.preset.kind)).toEqual(['linearGuide', 'gasSpring']);
    expect(state().joints).toHaveLength(1);
    const limits = motionLimits(state(), lift());
    // 伸びきり 700 - 可動量 0 での長さ 403 = 297mm（許容 0.5mm）
    expect(Math.abs(limits.max - 297)).toBeLessThanOrEqual(0.6);
    expect(limits.maxReason).toContain('伸びきり');
  });

  it('手を離すとガス圧で上がり、上端でドアロックが掛かって止まる。外すと動ける', () => {
    const { frame, carriage } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    addHardware({ preset: preset('gas.150n.400'), basePartId: frame, movingPartId: carriage });
    const latchId = addHardware({ preset: preset('latch.auto'), basePartId: frame, movingPartId: carriage })!;
    expect(state().hardware.find((item) => item.id === latchId)!.latch).toEqual({ at: 'max', engaged: false });

    // 150N の押し上げ > 昇降板の重さ（約 16N）なので、下で離すと上がっていく
    const model = buildMotionModel(state(), lift().id)!;
    expect(model.staticLoad(10).drive).toBeGreaterThan(0);

    useSimulationStore.getState().begin(state());
    const sim = () => workingProject();
    const simLift = () => sim().joints.find((joint): joint is MovableJoint => isMovableJoint(joint))!;
    const player = useMotionPlayer.getState();
    player.grab(lift().id);
    player.drag(50);
    player.release();
    runFrames(6);
    const top = motionLimits({ ...sim(), hardware: sim().hardware.map((item) => ({ ...item, latch: undefined })) }, simLift()).max;
    expect(simLift().value).toBeCloseTo(top, 1);
    expect(sim().hardware.find((item) => item.id === latchId)!.latch!.engaged).toBe(true);
    // ロック中は動かない
    const locked = motionLimits(sim(), simLift());
    expect(locked.max - locked.min).toBe(0);

    simSetLatch(latchId, false);
    const free = motionLimits(sim(), simLift());
    expect(free.min).toBe(0);
    // 設計データには何も残らない
    expect(lift().value).toBe(0);
    expect(state().hardware.find((item) => item.id === latchId)!.latch!.engaged).toBe(false);
    useSimulationStore.getState().end();
  });

  it('スライドボルトは自動では掛からない。上端まで支えて手で掛けると、そこで止まる', () => {
    const { frame, carriage } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    const boltId = addHardware({ preset: preset('latch.bolt'), basePartId: frame, movingPartId: carriage })!;
    useSimulationStore.getState().begin(state());
    const sim = () => workingProject();
    const simLift = () => sim().joints.find((joint): joint is MovableJoint => isMovableJoint(joint))!;
    // 上げきって手を離すと、ガススプリングが無いので自重で下まで落ちる（ボルトは勝手に掛からない）
    useMotionPlayer.getState().moveTo(lift().id, 720);
    runFrames(8);
    expect(simLift().value).toBeCloseTo(0);
    expect(sim().hardware.find((item) => item.id === boltId)!.latch!.engaged).toBe(false);
    // 支えたまま掛ける
    useMotionPlayer.getState().moveTo(lift().id, 720, boltId);
    runFrames(8);
    expect(simLift().value).toBeCloseTo(720);
    expect(sim().hardware.find((item) => item.id === boltId)!.latch!.engaged).toBe(true);
    useSimulationStore.getState().end();
  });

  it('L 字金具で固定した天板は昇降板と一緒に動き、重さにも入る', () => {
    const { frame, carriage, top } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    const before = buildMotionModel(state(), lift().id)!.massKg;
    addHardware({ preset: preset('bracket.l.40'), basePartId: carriage, movingPartId: top, quantity: 2 });
    expect(state().joints.find((joint) => joint.kind === 'fixed')?.movingPartId).toBe(top);
    expect(buildMotionModel(state(), lift().id)!.massKg).toBeGreaterThan(before);
    expect(state().parts.find((part) => part.id === top)!.operations).toHaveLength(4);
  });

  it('ドアロックは動く仕組みが無いと付けられない', () => {
    const { frame, carriage } = build();
    expect(addHardware({ preset: preset('latch.auto'), basePartId: frame, movingPartId: carriage })).toBeNull();
  });

  it('リニアガイドを外すと、支えを失ったガススプリングとドアロックも外れる', () => {
    const { frame, carriage } = build();
    const guide = addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 })!;
    addHardware({ preset: preset('gas.150n.400'), basePartId: frame, movingPartId: carriage });
    addHardware({ preset: preset('latch.auto'), basePartId: frame, movingPartId: carriage });
    removeHardware(guide);
    expect(state().joints).toHaveLength(0);
    expect(state().hardware).toHaveLength(0);
    expect(state().gasSprings).toHaveLength(0);
    expect(state().parts.every((part) => part.operations.length === 0)).toBe(true);
  });
});

describe('取り付ける順番・向きに左右されない（1 つの部材を複数の可動で動かす、が出ない）', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
    useEditorStore.setState({ selectedIds: [], selectedJointId: null, toasts: [] });
  });
  const toasts = () => useEditorStore.getState().toasts.map((toast) => toast.message);

  it('左右の柱にリニアガイドを 1 本ずつ付けても、昇降板の動きは 1 つ', () => {
    const left = addPart({ name: '左柱', size: { x: 40, y: 1200, z: 40 }, position: [-280, 600, 0] });
    const right = addPart({ name: '右柱', size: { x: 40, y: 1200, z: 40 }, position: [280, 600, 0] });
    // 昇降板は左右の柱の正面まで届く幅
    const carriage = addPart({ name: '昇降板', size: { x: 600, y: 300, z: 18 }, position: [0, 600, 57] });
    expect(addHardware({ preset: preset('linear.guide.800'), basePartId: left, movingPartId: carriage })).not.toBeNull();
    expect(addHardware({ preset: preset('linear.guide.800'), basePartId: right, movingPartId: carriage })).not.toBeNull();
    expect(state().joints.filter((joint) => joint.kind === 'prismatic')).toHaveLength(1);
    expect(state().hardware.every((item) => item.jointId === lift().id)).toBe(true);
  });

  it('昇降板に金具で固定した天板と固定側の間にガススプリングを付けると、リニアの動きを補助する（丁番は足さない）', () => {
    const { frame, carriage, top } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    addHardware({ preset: preset('bracket.l.40'), basePartId: carriage, movingPartId: top, quantity: 2 });
    const gas = addHardware({ preset: preset('gas.150n.400'), basePartId: frame, movingPartId: top });
    expect(gas).not.toBeNull();
    expect(state().hardware.some((item) => item.preset.kind === 'hinge')).toBe(false);
    expect(state().gasSprings[0]!.jointId).toBe(lift().id);
    expect(toasts().some((message) => message.includes('複数の可動'))).toBe(false);
  });

  it('金具を先に付けても、固定側と取り付ける側を逆に選んでも、天板は昇降板と一緒に動く', () => {
    const { frame, carriage, top } = build();
    addHardware({ preset: preset('bracket.l.40'), basePartId: top, movingPartId: carriage, quantity: 2 });
    expect(addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 })).not.toBeNull();
    const fixed = state().joints.find((joint) => joint.kind === 'fixed');
    expect(fixed).toMatchObject({ basePartId: carriage, movingPartId: top });
    expect(toasts().some((message) => message.includes('複数の可動'))).toBe(false);
  });

  it('ドアロックも、金具で一緒に動く部材と固定側の間に付けられる', () => {
    const { frame, carriage, top } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    addHardware({ preset: preset('bracket.l.40'), basePartId: carriage, movingPartId: top });
    expect(addHardware({ preset: preset('latch.auto'), basePartId: frame, movingPartId: top })).not.toBeNull();
  });

  it('動く部材を固定側へ金具で留めてしまうと、動かないことを知らせ、実際に動けなくなる', () => {
    const { frame, carriage } = build();
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage, quantity: 2 });
    addHardware({ preset: preset('bracket.l.40'), basePartId: frame, movingPartId: carriage });
    expect(toasts().some((message) => message.includes('実際には動きません'))).toBe(true);
    const limits = motionLimits(state(), lift());
    expect(limits.max - limits.min).toBe(0);
  });

  it('向きのそろわない 2 本目のガイドは付けられない', () => {
    const { frame, carriage } = build();
    const side = addPart({ name: '側板', size: { x: 18, y: 1200, z: 400 }, position: [-300, 600, 200] });
    addHardware({ preset: preset('linear.guide.800'), basePartId: frame, movingPartId: carriage });
    // 上下に動く昇降板に、水平に引き出すレールを別の側板から足すと、実物では引っかかって動かない
    expect(addHardware({ preset: preset('slide.side.350'), basePartId: side, movingPartId: carriage })).toBeNull();
    expect(toasts().at(-1)).toContain('そろって');
  });
});

describe('柱から離れた位置に置いた板にガイドを付ける（画面で報告された状況）', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
    useEditorStore.setState({ selectedIds: [], selectedJointId: null, toasts: [] });
  });
  const toasts = () => useEditorStore.getState().toasts.map((toast) => toast.message);
  const partById = (id: string) => state().parts.find((part) => part.id === id)!;
  function scene(): { post: string; board: string; shelf: string } {
    const post = addPart({ name: '柱', size: { x: 40, y: 1500, z: 40 }, position: [-400, 750, 0] });
    // 柱から 350mm 離れて、広い面を柱に向けた板と、その下の棚
    const board = addPart({ name: '板', size: { x: 18, y: 300, z: 500 }, position: [0, 700, 0] });
    const shelf = addPart({ name: '棚', size: { x: 200, y: 18, z: 500 }, position: [109, 541, 0] });
    return { post, board, shelf };
  }

  it('板（と接している棚）を、ガイドの厚み 28mm の位置まで柱へ寄せて付ける', () => {
    const { post, board, shelf } = scene();
    expect(addHardware({ preset: preset('linear.guide.800'), basePartId: post, movingPartId: board })).not.toBeNull();
    // 柱の面 x = -380、板の厚み 18 → 板の中心は -380 + 28 + 9
    expect(partById(board).transform.position[0]).toBeCloseTo(-343);
    expect(partById(shelf).transform.position[0]).toBeCloseTo(-343 + 109);
    expect(partById(post).transform.position[0]).toBe(-400);
    expect(toasts().some((message) => message.includes('寄せました'))).toBe(true);
  });

  it('ガススプリングはガイドの両脇に付き、下端は柱に留まる（宙に浮かない）', () => {
    const { post, board } = scene();
    addHardware({ preset: preset('linear.guide.800'), basePartId: post, movingPartId: board });
    expect(addHardware({ preset: preset('gas.150n.400'), basePartId: post, movingPartId: board, quantity: 2 })).not.toBeNull();
    const mount = state().gasSprings[0]!;
    // 柱ローカル: 柱の面（x = 20）のすぐ前、横方向（z）はガイドの脇
    expect(mount.baseAnchor[0]).toBeGreaterThan(20);
    expect(mount.baseAnchor[0]).toBeLessThan(40);
    expect(Math.abs(mount.baseAnchor[2])).toBeCloseTo(32);
    // 穴は柱と板にあく（ほかの部材や宙ではない）
    const gasHoles = state().parts.filter((part) => part.operations.some((operation) => operation.note === mount.hardwareId)).map((part) => part.id).sort();
    expect(gasHoles).toEqual([post, board].sort());
  });

  it('柱に向いた面がブロックより狭いと、理由を出して付けない', () => {
    const post = addPart({ name: '柱', size: { x: 40, y: 1500, z: 40 }, position: [-400, 750, 0] });
    const board = addPart({ name: '板', size: { x: 500, y: 300, z: 18 }, position: [0, 700, 0] });
    expect(addHardware({ preset: preset('linear.guide.800'), basePartId: post, movingPartId: board })).toBeNull();
    expect(toasts().at(-1)).toContain('狭い');
  });

  it('動いていない部材にガススプリングだけを付けても、勝手に丁番は足さない', () => {
    const { post, board } = scene();
    expect(addHardware({ preset: preset('gas.150n.400'), basePartId: post, movingPartId: board })).toBeNull();
    expect(state().hardware).toHaveLength(0);
    expect(toasts().at(-1)).toContain('先に丁番・レール・リニアガイド');
  });
});

describe('面を選んで取り付ける（設計書 DESIGN_V2 §10.6）', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
    useEditorStore.setState({ selectedIds: [], selectedJointId: null, toasts: [] });
  });
  const toasts = () => useEditorStore.getState().toasts.map((toast) => toast.message);
  const partById = (id: string) => state().parts.find((part) => part.id === id)!;

  it('リニアガイドは選んだ柱の面に付き、向かい合う板の面にブロックが付く', () => {
    const post = addPart({ name: '柱', size: { x: 40, y: 1500, z: 40 }, position: [-400, 750, 0] });
    const board = addPart({ name: '板', size: { x: 18, y: 300, z: 500 }, position: [0, 700, 0] });
    expect(addHardware({ preset: preset('linear.guide.800'), basePartId: post, movingPartId: board, faces: { base: '+x', moving: '-x' } })).not.toBeNull();
    expect(partById(board).transform.position[0]).toBeCloseTo(-343);
    const guide = state().hardware[0]!;
    expect(guide.faces).toEqual({ base: '+x', moving: '-x' });
    // 穴は選んだ面から掘る
    expect(partById(post).operations.every((operation) => 'direction' in operation && operation.direction === '+x')).toBe(true);
    expect(partById(board).operations.every((operation) => 'direction' in operation && operation.direction === '-x')).toBe(true);
  });

  it('向かい合っていない面を選ぶと、理由を出して付けない', () => {
    const post = addPart({ name: '柱', size: { x: 40, y: 1500, z: 40 }, position: [-400, 750, 0] });
    const board = addPart({ name: '板', size: { x: 18, y: 300, z: 500 }, position: [0, 700, 0] });
    expect(addHardware({ preset: preset('linear.guide.800'), basePartId: post, movingPartId: board, faces: { base: '+x', moving: '+x' } })).toBeNull();
    expect(toasts().at(-1)).toContain('向かい合っていません');
  });

  it('L字金具は選んだ 2 面の角に付く。直角でない面は断る', () => {
    const bottom = addPart({ name: '底板', size: { x: 600, y: 18, z: 400 }, position: [0, 9, 0] });
    const side = addPart({ name: '側板', size: { x: 18, y: 382, z: 364 }, position: [-291, 209, 0] });
    const id = addHardware({ preset: preset('bracket.l.40'), basePartId: bottom, movingPartId: side, faces: { base: '+y', moving: '+x' } })!;
    const bracket = state().hardware.find((item) => item.id === id)!;
    // 底板ローカル: 上面（y = 9）と側板の内側の面（x = -282）の角
    expect(bracket.position[0]).toBeCloseTo(-282);
    expect(bracket.position[1]).toBeCloseTo(9);
    expect(partById(bottom).operations.every((operation) => 'direction' in operation && operation.direction === '+y')).toBe(true);
    expect(partById(side).operations.every((operation) => 'direction' in operation && operation.direction === '+x')).toBe(true);
    expect(addHardware({ preset: preset('bracket.l.40'), basePartId: bottom, movingPartId: side, faces: { base: '+y', moving: '-y' } })).toBeNull();
    expect(toasts().at(-1)).toContain('直角');
  });
});

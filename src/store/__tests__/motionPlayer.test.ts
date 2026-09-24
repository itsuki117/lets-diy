import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHardwarePreset } from '../../core/hardware/presets';
import { createProject } from '../../core/project/createProject';
import { addHardware } from '../commands/hardwareCommands';
import { addPart } from '../commands/partCommands';
import { useEditorStore } from '../useEditorStore';
import { useMotionPlayer } from '../useMotionPlayer';
import { useProjectStore } from '../useProjectStore';
import { useSimulationStore, workingProject } from '../useSimulationStore';

// 手動で進める requestAnimationFrame と時計
let now = 0;
let queue: Array<(t: number) => void> = [];
function runFrames(seconds: number, fps = 60): void {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames && queue.length > 0; i += 1) {
    now += 1000 / fps;
    const current = queue;
    queue = [];
    for (const callback of current) callback(now);
  }
}

function lidBox(presetId?: string): string {
  const back = addPart({ name: '背板', size: { x: 600, y: 382, z: 18 }, position: [0, 209, -191] });
  addPart({ name: '左側板', size: { x: 18, y: 382, z: 364 }, position: [-291, 209, 0] });
  addPart({ name: '右側板', size: { x: 18, y: 382, z: 364 }, position: [291, 209, 0] });
  const lid = addPart({ name: 'フタ', size: { x: 600, y: 18, z: 400 }, position: [0, 409, 0] });
  // 回転軸はスライド丁番。ガススプリングはその動きを補助する
  addHardware({ preset: getHardwarePreset('hinge.concealed.35')!, basePartId: back, movingPartId: lid, quantity: 2 });
  if (presetId) addHardware({ preset: getHardwarePreset(presetId)!, basePartId: back, movingPartId: lid, quantity: 2 });
  return useProjectStore.getState().project.joints[0]!.id;
}

/** 動作確認に入る（設計データを写した別の世界で動かす） */
const enterMotionCheck = (): void => useSimulationStore.getState().begin(useProjectStore.getState().project);

const value = (): number => {
  const joint = workingProject().joints[0]!;
  return joint.kind === 'fixed' ? 0 : joint.value;
};

describe('motion player', () => {
  beforeEach(() => {
    now = 0;
    queue = [];
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (callback: (t: number) => void) => { queue.push(callback); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
    useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
    useEditorStore.setState({ selectedIds: [], selectedJointId: null, toasts: [] });
    useMotionPlayer.setState({ phase: 'idle', physics: true, jointId: null });
    useSimulationStore.getState().end();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a lid without support falls shut when released', () => {
    const jointId = lidBox();
    enterMotionCheck();
    const player = useMotionPlayer.getState();
    player.grab(jointId);
    player.drag(80);
    player.release();
    runFrames(3);
    expect(useMotionPlayer.getState().phase).toBe('idle');
    expect(value()).toBeCloseTo(0);
  });

  it('motion check never writes into the design data or its history', () => {
    const jointId = lidBox('gas.50n.165');
    const design = useProjectStore.getState().project;
    const history = useProjectStore.getState().past.length;
    enterMotionCheck();
    useMotionPlayer.getState().moveTo(jointId, 110);
    runFrames(5);
    expect(value()).toBeGreaterThan(90);
    // 設計データはそのまま（閉じた状態）。履歴も増えない
    expect(useProjectStore.getState().project).toBe(design);
    expect(useProjectStore.getState().past.length).toBe(history);
    // 出ると写しは捨てられ、次に入ると設計どおり（閉じた状態）から始まる
    useSimulationStore.getState().end();
    expect(workingProject()).toBe(design);
    enterMotionCheck();
    expect(value()).toBe(0);
  });

  it('a lift-assist gas spring holds the lid open after the hand lets go', () => {
    const jointId = lidBox('gas.50n.165');
    enterMotionCheck();
    const player = useMotionPlayer.getState();
    player.moveTo(jointId, 110);
    runFrames(5);
    expect(useMotionPlayer.getState().phase).toBe('idle');
    expect(value()).toBeGreaterThan(90);
  });

  it('the hand cannot pull the lid past the gas spring stroke', () => {
    const jointId = lidBox('gas.50n.165');
    useProjectStore.getState().applyCommand('短いガス', (draft) => { draft.gasSprings[0]!.strokeMax -= 20; });
    enterMotionCheck();
    const player = useMotionPlayer.getState();
    player.grab(jointId);
    player.drag(110);
    expect(value()).toBeLessThan(100);
    player.release();
    runFrames(5);
  });

  it('without physics the lid stays where the hand left it', () => {
    const jointId = lidBox();
    enterMotionCheck();
    useMotionPlayer.getState().setPhysics(false);
    const player = useMotionPlayer.getState();
    player.grab(jointId);
    player.drag(60);
    player.release();
    expect(useMotionPlayer.getState().phase).toBe('idle');
    expect(value()).toBeCloseTo(60);
  });
});

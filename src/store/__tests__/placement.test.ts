import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { motionLimits } from '../../core/motion/limits';
import { isMovableJoint } from '../../core/types';
import { addPart } from '../commands/partCommands';
import { clickPlacement, confirmPlacement, hoverPlacement, nudgePlacement, placementPlan, startPlacement } from '../commands/placementCommands';
import { IDLE_PLACEMENT, useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

/**
 * 取り付けの流れ（設計書 DESIGN_V2 §10.7）:
 * 固定側の面に部品を置く（スナップ・微調整）→ 動く側の面にマウスを乗せて透過表示 → クリック → 取り付ける
 */

const editor = () => useEditorStore.getState();
const state = () => useProjectStore.getState().project;
const partById = (id: string) => state().parts.find((part) => part.id === id)!;
const choose = (presetId: string, quantity = 1) => editor().setPlacementOptions({ presetId, quantity, autoHoles: true, snapToMount: true, latchAt: 'auto' });
const plan = () => placementPlan(state(), editor().placement, editor().placementOptions);

function scene(): { post: string; board: string } {
  const post = addPart({ name: '柱', size: { x: 40, y: 1500, z: 40 }, position: [-400, 750, 0] });
  const board = addPart({ name: '板', size: { x: 18, y: 300, z: 500 }, position: [0, 700, 0] });
  return { post, board };
}

/** リニアガイドを、柱の +X 面の中ほど（柱ローカル y = 100）に置いて付ける */
function installGuide(post: string, board: string): void {
  choose('linear.guide.800');
  startPlacement();
  clickPlacement({ partId: post, face: '+x', point: [20, 100, 0] });
  clickPlacement({ partId: board, face: '-x', point: [-9, 0, 0] });
  confirmPlacement();
}

describe('取り付けの流れ', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
    useEditorStore.setState({ placement: IDLE_PLACEMENT, toasts: [], snap: { grid: 10, angle: 90 } });
  });

  it('固定側は面の上のクリック位置に、グリッドにそろえて置き、矢印で 1 目盛りずつ動かせる', () => {
    const { post } = scene();
    choose('linear.guide.800');
    startPlacement();
    clickPlacement({ partId: post, face: '+x', point: [19.2, 103.4, 4.9] });
    expect(editor().placement.step).toBe('moving');
    expect(editor().placement.base!.point).toEqual([20, 100, 0]);
    nudgePlacement(1, 1);
    expect(editor().placement.base!.point).toEqual([20, 110, 0]);
    // 面の外へは出ない
    for (let i = 0; i < 10; i += 1) nudgePlacement(2, 1);
    expect(editor().placement.base!.point[2]).toBe(20);
  });

  it('動く側にマウスを乗せると、取り付けた結果（寄せた板も）を計算する。クリックで決まり、取り付けで確定する', () => {
    const { post, board } = scene();
    choose('linear.guide.800');
    startPlacement();
    clickPlacement({ partId: post, face: '+x', point: [20, 100, 0] });
    hoverPlacement({ partId: board, face: '-x', point: [-9, 0, 0] });
    const preview = plan();
    expect(preview && !('error' in preview)).toBe(true);
    if (!preview || 'error' in preview) return;
    expect(preview.moved).toContain(board);
    // プレビューではまだ何も変わらない
    expect(state().hardware).toHaveLength(0);
    expect(partById(board).transform.position[0]).toBe(0);

    clickPlacement({ partId: board, face: '-x', point: [-9, 0, 0] });
    expect(editor().placement.step).toBe('ready');
    expect(confirmPlacement()).not.toBeNull();
    expect(editor().placement.step).toBeNull();
    const guide = state().hardware[0]!;
    // レールは置いた位置に。ブロックは板の中心の高さ（柱ローカル y = -50）でレールに載る
    expect(guide.position[1]).toBeCloseTo(100);
    expect(guide.travelOffset).toBeCloseTo(-50 - (100 - 400 + 40));
    const joint = state().joints.find(isMovableJoint)!;
    expect(joint.range.min).toBeCloseTo(-guide.travelOffset!);
    expect(joint.range.max).toBeCloseTo(720 - guide.travelOffset!);
    expect(partById(board).transform.position[0]).toBeCloseTo(-343);
  });

  it('レールが板の高さに届かない位置に置くと、赤（付けられない）になり理由が出る', () => {
    const { post, board } = scene();
    choose('linear.guide.500');
    startPlacement();
    clickPlacement({ partId: post, face: '+x', point: [20, 600, 0] });
    hoverPlacement({ partId: board, face: '-x', point: [-9, 0, 0] });
    const preview = plan();
    expect(preview && 'error' in preview ? preview.error : '').toContain('届いていません');
    clickPlacement({ partId: board, face: '-x', point: [-9, 0, 0] });
    expect(editor().placement.step).toBe('moving');
  });

  it('ガススプリングは、取付点の間が伸縮範囲に入る位置にしか付けられない', () => {
    const { post, board } = scene();
    installGuide(post, board);
    choose('gas.150n.400');
    startPlacement();
    // 下端を柱の下の方（柱ローカル y = -600、床から 150mm）に置く
    clickPlacement({ partId: post, face: '+x', point: [20, -600, 0] });
    // 板の中ほど: 取付点の間 約 550mm（400〜700 に入る）
    hoverPlacement({ partId: board, face: '-x', point: [-9, 0, 100] });
    const ok = plan();
    expect(ok && !('error' in ok)).toBe(true);
    if (ok && !('error' in ok)) expect(ok.messages.some(([, message]) => message.includes('動きます'))).toBe(true);
    // 下端をもっと上へ置き直すと短すぎる
    editor().setPlacement({ step: 'base', moving: null, hover: null });
    clickPlacement({ partId: post, face: '+x', point: [20, -300, 0] });
    hoverPlacement({ partId: board, face: '-x', point: [-9, 0, 100] });
    const tooShort = plan();
    expect(tooShort && 'error' in tooShort ? tooShort.error : '').toContain('400〜700mm');
    clickPlacement({ partId: board, face: '-x', point: [-9, 0, 100] });
    expect(editor().placement.step).toBe('moving');
    expect(editor().toasts.at(-1)?.message).toContain('400〜700mm');
  });

  it('付けたガススプリングの伸縮範囲が、上下の可動範囲を決める', () => {
    const { post, board } = scene();
    installGuide(post, board);
    choose('gas.150n.400');
    startPlacement();
    clickPlacement({ partId: post, face: '+x', point: [20, -600, 0] });
    clickPlacement({ partId: board, face: '-x', point: [-9, 0, 100] });
    expect(confirmPlacement()).not.toBeNull();
    const joint = state().joints.find(isMovableJoint)!;
    const limits = motionLimits(state(), joint);
    // 伸びきり（700mm）で上が止まる。ガイドの上端（range.max）より手前
    expect(limits.max).toBeLessThan(joint.range.max);
    expect(limits.maxReason).toContain('伸びきり');
  });

  it('ドアロックの受け金具は、動く部材がロック位置で届く場所にしか置けない', () => {
    const { post, board } = scene();
    installGuide(post, board);
    choose('latch.auto');
    startPlacement();
    // 柱の裏（板の通り道ではない）
    clickPlacement({ partId: post, face: '-x', point: [-20, 400, 0] });
    hoverPlacement({ partId: board, face: '-x', point: [-9, 0, 0] });
    const far = plan();
    expect(far && 'error' in far ? far.error : '').toContain('届きません');
  });
});

describe('設計データは動作確認の状態を持たない', () => {
  it('読み込むと、動かした量・ロック・ガスのロックは設計どおり（0 / 外れ）に戻る', async () => {
    const { toDocument, fromDocument } = await import('../../core/project/serialize');
    useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
    const { post, board } = scene();
    installGuide(post, board);
    const saved = toDocument(state());
    const joint = saved.project.joints.find(isMovableJoint)!;
    const dirty = { ...saved, project: { ...saved.project, joints: saved.project.joints.map((item) => (item.id === joint.id ? { ...joint, value: 120 } : item)) } };
    const loaded = fromDocument(JSON.parse(JSON.stringify(dirty)));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value.joints.find(isMovableJoint)!.value).toBe(0);
  });
});

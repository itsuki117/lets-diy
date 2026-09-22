import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../core/project/createProject';
import { createOperationId } from '../../core/ids';
import { HISTORY_LIMIT } from '../../core/constants';
import type { RoundHoleOperation } from '../../core/types';
import { useProjectStore } from '../useProjectStore';
import { useEditorStore } from '../useEditorStore';
import { addPart, duplicateParts, removeParts, renamePart, setPartSize } from '../commands/partCommands';
import { alignParts, setPartPosition, setPartRotation } from '../commands/transformCommands';
import { addOperation, removeOperation, reorderOperation, setOperationEnabled, updateOperation } from '../commands/operationCommands';

const reset = (): void => {
  useProjectStore.setState({ project: createProject(), past: [], future: [], transientBase: null, savedAt: null });
  useEditorStore.setState({ selectedIds: [], snap: { grid: 0, angle: 0 } });
};

const snapshot = () => JSON.parse(JSON.stringify(useProjectStore.getState().project));
const store = () => useProjectStore.getState();

const hole = (): RoundHoleOperation => ({
  id: createOperationId(),
  type: 'roundHole',
  enabled: true,
  diameter: 8,
  depth: 9,
  through: true,
  position: [0, 0, 0],
  direction: '-z',
});

describe('history', () => {
  beforeEach(reset);

  it('applyCommand -> undo で完全に元の Project に戻る', () => {
    const before = snapshot();
    addPart({ size: { x: 600, y: 300, z: 18 } });
    expect(store().project.parts).toHaveLength(1);
    store().undo();
    expect(snapshot()).toEqual(before);
  });

  it('redo で再適用される', () => {
    addPart({ size: { x: 600, y: 300, z: 18 } });
    const after = snapshot();
    store().undo();
    store().redo();
    expect(snapshot()).toEqual(after);
  });

  it('変化のないコマンドは履歴に積まれない', () => {
    addPart({});
    const depth = store().past.length;
    renamePart('存在しない', '名前');
    expect(store().past.length).toBe(depth);
  });

  it('新しい操作で redo スタックが捨てられる', () => {
    addPart({});
    store().undo();
    expect(store().future).toHaveLength(1);
    addPart({});
    expect(store().future).toHaveLength(0);
  });

  it('履歴上限を超えると最古が捨てられる', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) addPart({});
    expect(store().past.length).toBe(HISTORY_LIMIT);
  });

  it('Transient は commit で 1 件だけ履歴が増える', () => {
    const id = addPart({});
    const depth = store().past.length;
    store().beginTransient();
    for (let i = 1; i <= 10; i += 1) {
      store().updateTransient((draft) => {
        const part = draft.parts.find((p) => p.id === id);
        if (part) part.transform.position = [i * 10, 0, 0];
      });
    }
    expect(store().past.length).toBe(depth);
    store().commitTransient('部材を移動');
    expect(store().past.length).toBe(depth + 1);
    expect(store().project.parts[0]?.transform.position).toEqual([100, 0, 0]);
  });

  it('Transient を abort すると元に戻り履歴も増えない', () => {
    const id = addPart({});
    const before = snapshot();
    const depth = store().past.length;
    store().beginTransient();
    store().updateTransient((draft) => {
      const part = draft.parts.find((p) => p.id === id);
      if (part) part.transform.position = [999, 0, 0];
    });
    store().abortTransient();
    expect(snapshot()).toEqual(before);
    expect(store().past.length).toBe(depth);
  });

  it('Transient の commit を undo すると元の位置に戻る', () => {
    const id = addPart({});
    const before = snapshot();
    store().beginTransient();
    store().updateTransient((draft) => {
      const part = draft.parts.find((p) => p.id === id);
      if (part) part.transform.position = [500, 0, 0];
    });
    store().commitTransient('部材を移動');
    store().undo();
    expect(store().project.parts[0]?.transform.position).toEqual(before.parts[0].transform.position);
  });

  it('読み込みは履歴をクリアする', () => {
    addPart({});
    store().loadProject(createProject());
    expect(store().past).toHaveLength(0);
    expect(store().future).toHaveLength(0);
  });
});

describe('全コマンドの undo 網羅', () => {
  beforeEach(reset);

  /** 実行 -> undo で元に戻ることを全コマンドで確認する。新コマンドを足したらここに追加する。 */
  const cases: Array<[string, () => void]> = [
    ['addPart', () => addPart({ size: { x: 600, y: 300, z: 18 } })],
    ['duplicateParts', () => duplicateParts([useProjectStore.getState().project.parts[0]!.id])],
    ['removeParts', () => removeParts([useProjectStore.getState().project.parts[0]!.id])],
    ['renamePart', () => renamePart(useProjectStore.getState().project.parts[0]!.id, '新しい名前')],
    ['setPartSize', () => setPartSize(useProjectStore.getState().project.parts[0]!.id, { x: 100, y: 200, z: 30 })],
    ['setPartPosition', () => setPartPosition(useProjectStore.getState().project.parts[0]!.id, [123, 45, 67])],
    ['setPartRotation', () => setPartRotation(useProjectStore.getState().project.parts[0]!.id, [0, 90, 0])],
    ['addOperation', () => addOperation(useProjectStore.getState().project.parts[0]!.id, hole())],
  ];

  it.each(cases)('%s は undo で完全に戻る', (_name, run) => {
    addPart({ size: { x: 600, y: 300, z: 18 } });
    const before = snapshot();
    run();
    store().undo();
    expect(snapshot()).toEqual(before);
  });

  it('alignParts は undo で戻る', () => {
    addPart({ size: { x: 600, y: 300, z: 18 }, position: [0, 0, 0] });
    addPart({ size: { x: 600, y: 300, z: 18 }, position: [900, 120, 0] });
    const before = snapshot();
    alignParts(store().project.parts.map((p) => p.id), 'x', 'min');
    expect(snapshot()).not.toEqual(before);
    store().undo();
    expect(snapshot()).toEqual(before);
  });

  it('加工の更新 / 無効化 / 並べ替え / 削除も undo で戻る', () => {
    const id = addPart({ size: { x: 600, y: 300, z: 18 } });
    const a = hole();
    const b = hole();
    addOperation(id, a);
    addOperation(id, b);
    const before = snapshot();
    const opId = store().project.parts[0]!.operations[0]!.id;

    const target = store().project.parts[0]!.operations[0] as RoundHoleOperation;
    updateOperation(id, { ...target, diameter: 6 });
    store().undo();
    expect(snapshot()).toEqual(before);

    setOperationEnabled(id, opId, false);
    store().undo();
    expect(snapshot()).toEqual(before);

    reorderOperation(id, opId, 1);
    store().undo();
    expect(snapshot()).toEqual(before);

    removeOperation(id, opId);
    store().undo();
    expect(snapshot()).toEqual(before);
  });
});

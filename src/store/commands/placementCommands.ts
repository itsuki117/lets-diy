import { getHardwarePreset } from '../../core/hardware/presets';
import type { AxisDirection, Part, Project, Vec3 } from '../../core/types';
import { useEditorStore, type HardwarePlacement, type PlacementOptions, type PlacementPoint } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';
import { addHardware, planHardware, type AddHardwareInput, type HardwarePlan } from './hardwareCommands';

/**
 * 金物の取り付けの操作（設計書 DESIGN_V2 §10.7）。
 *
 * 1. 固定側の面をクリックして、固定側の部品を置く（グリッドにスナップ、矢印で微調整）
 * 2. 動く側の面にマウスを乗せると、取り付けた結果が透過表示される。
 *    取り付けられない位置（ガススプリングの伸縮範囲外など）は赤く表示され、クリックしても決まらない
 * 3. ［取り付ける］で確定
 */

const editor = () => useEditorStore.getState();
const project = () => useProjectStore.getState().project;

const faceIndex = (face: AxisDirection): 0 | 1 | 2 => (face[1] === 'x' ? 0 : face[1] === 'y' ? 1 : 2);

/** 面の上の点を、グリッドにそろえて面の中に収める（部材ローカル） */
export function snapToFace(part: Part, face: AxisDirection, point: Vec3, grid: number): Vec3 {
  const half: Vec3 = [part.size.x / 2, part.size.y / 2, part.size.z / 2];
  const k = faceIndex(face);
  const step = grid > 0 ? grid : 1;
  return [0, 1, 2].map((i) => {
    if (i === k) return (face[0] === '+' ? 1 : -1) * half[i]!;
    const snapped = Math.round(point[i]! / step) * step;
    return Math.min(Math.max(snapped, -half[i]!), half[i]!);
  }) as unknown as Vec3;
}

export function placementInput(
  placement: HardwarePlacement,
  options: PlacementOptions,
  moving: PlacementPoint | null = placement.moving,
): AddHardwareInput | null {
  const preset = getHardwarePreset(options.presetId);
  const base = placement.base;
  if (!preset || !base || !moving) return null;
  return {
    preset,
    basePartId: base.partId,
    movingPartId: moving.partId,
    quantity: options.quantity,
    autoHoles: options.autoHoles,
    snapToMount: options.snapToMount,
    faces: { base: base.face, moving: moving.face },
    points: {
      base: base.point,
      ...(preset.kind === 'gasSpring' ? { moving: moving.point } : {}),
      turn: placement.turn,
      flip: placement.flip,
    },
    ...(preset.kind === 'latch' && options.latchAt !== 'auto' ? { latchAt: options.latchAt } : {}),
  };
}

/** 透過表示に使う計画。動く側を選んでいる途中はマウスの位置で計算する */
export function placementPlan(source: Project, placement: HardwarePlacement, options: PlacementOptions): HardwarePlan | { error: string } | null {
  const moving = placement.step === 'moving'
    ? (placement.hover && placement.hover.partId !== placement.base?.partId ? placement.hover : null)
    : placement.moving;
  const input = placementInput(placement, options, moving);
  return input ? planHardware(source, input) : null;
}

export function startPlacement(): void {
  editor().setPlacement({ step: 'base', base: null, moving: null, hover: null, turn: false, flip: false });
}

function snapped(ref: PlacementPoint): PlacementPoint | null {
  const part = project().parts.find((item) => item.id === ref.partId);
  return part ? { ...ref, point: snapToFace(part, ref.face, ref.point, editor().snap.grid) } : null;
}

export function hoverPlacement(ref: PlacementPoint | null): void {
  const current = editor().placement.hover;
  const next = ref ? snapped(ref) : null;
  if (current?.partId === next?.partId && current?.face === next?.face
    && current?.point.every((v, i) => v === next?.point[i])) return;
  editor().setPlacement({ hover: next });
}

export function clickPlacement(ref: PlacementPoint): void {
  const placement = editor().placement;
  const point = snapped(ref);
  if (!point) return;
  if (placement.step === 'base') {
    editor().setPlacement({ base: point, moving: null, step: 'moving', hover: null });
    return;
  }
  if (placement.step === 'moving' || placement.step === 'ready') {
    if (point.partId === placement.base?.partId) {
      editor().pushToast('warning', '固定側と同じ部材は選べません。動く側の部材の面をクリックしてください');
      return;
    }
    const input = placementInput(placement, editor().placementOptions, point);
    if (!input) return;
    const plan = planHardware(project(), input);
    if ('error' in plan) {
      editor().pushToast('warning', plan.error);
      return;
    }
    editor().setPlacement({ moving: point, step: 'ready', hover: null });
  }
}

/** 置いた固定側の部品を、面の上でグリッド 1 目盛りずつ動かす */
export function nudgePlacement(axis: 0 | 1 | 2, direction: 1 | -1): void {
  const placement = editor().placement;
  const base = placement.base;
  const part = base ? project().parts.find((item) => item.id === base.partId) : undefined;
  if (!base || !part) return;
  const step = editor().snap.grid > 0 ? editor().snap.grid : 1;
  const moved = base.point.map((v, i) => (i === axis ? v + direction * step : v)) as unknown as Vec3;
  editor().setPlacement({ base: { ...base, point: snapToFace(part, base.face, moved, editor().snap.grid) } });
}

export function confirmPlacement(): string | null {
  const placement = editor().placement;
  const input = placementInput(placement, editor().placementOptions);
  if (!input) return null;
  const id = addHardware(input);
  if (id) {
    editor().cancelPlacement();
    editor().selectHardware(id);
  }
  return id;
}

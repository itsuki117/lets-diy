import { create } from 'zustand';
import { DEFAULT_SNAP } from '../core/constants';
import type { InterferencePair } from '../core/collision/interference';
import type { MotionScanResult } from '../core/motion/motionScan';
import type {
  AxisDirection,
  JointId,
  EditorMode,
  FaceRef,
  FaceSnapSession,
  GizmoMode,
  OperationDraft,
  PartId,
  SnapSettings,
  Vec3,
} from '../core/types';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

/** 面の上の点（部材ローカル mm） */
export interface PlacementPoint {
  partId: PartId;
  face: AxisDirection;
  point: Vec3;
}

/**
 * 金物の取り付け（設計書 DESIGN_V2 §10.7）。
 *   base   固定側の面の上に、固定側の部品（レール・座金・ガスの下端・ロックの受け）を置く
 *   moving 動く側の面にマウスを乗せると、取り付けた結果が透過表示される。クリックで決める
 *   ready  透過表示を確かめて［取り付ける］
 */
export interface HardwarePlacement {
  step: 'base' | 'moving' | 'ready' | null;
  base: PlacementPoint | null;
  moving: PlacementPoint | null;
  /** マウスが乗っている面の上の点 */
  hover: PlacementPoint | null;
  /** レール・ガイドの向き: 面の中で 90° 回す / 反対向き */
  turn: boolean;
  flip: boolean;
}

export interface PlacementOptions {
  presetId: string;
  quantity: number;
  autoHoles: boolean;
  snapToMount: boolean;
  latchAt: 'auto' | 'min' | 'max';
}

export const IDLE_PLACEMENT: HardwarePlacement = { step: null, base: null, moving: null, hover: null, turn: false, flip: false };

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ViewOptions {
  grid: boolean;
  shadows: boolean;
}

export interface EditorStore {
  workspace: 'edit' | 'motionCheck';
  createCategory: 'wood' | 'hardware';
  mode: EditorMode;
  selectedIds: PartId[];
  /** 可動モードで選択中の joint */
  selectedJointId: JointId | null;
  selectedHardwareId: string | null;
  placement: HardwarePlacement;
  placementOptions: PlacementOptions;
  /** 可動範囲の走査結果。null なら未実行 */
  motionScan: MotionScanResult | null;
  hoveredId: PartId | null;
  /** 面スナップ中にホバーしている面 */
  hoveredFace: FaceRef | null;
  gizmoMode: GizmoMode;
  snap: SnapSettings;
  /** 加工位置の微調整ボタンのきざみ (mm) */
  nudgeStep: number;
  faceSnap: FaceSnapSession | null;
  operationDraft: OperationDraft | null;
  viewOptions: ViewOptions;
  toasts: Toast[];
  /** 部品表パネルを開いているか */
  bomOpen: boolean;
  /** 干渉チェックの結果。null なら未実行（パネルを閉じている） */
  interference: InterferencePair[] | null;
  /** ビューポート上部に出す 1 行ガイド。null なら状況から自動生成する。 */
  hintOverride: string | null;

  setWorkspace: (workspace: 'edit' | 'motionCheck') => void;
  setPlacement: (patch: Partial<HardwarePlacement>) => void;
  setPlacementOptions: (patch: Partial<PlacementOptions>) => void;
  cancelPlacement: () => void;
  setCreateCategory: (category: 'wood' | 'hardware') => void;
  setMode: (mode: EditorMode) => void;
  select: (ids: PartId[], additive?: boolean) => void;
  toggleSelect: (id: PartId) => void;
  clearSelection: () => void;
  selectJoint: (id: JointId | null) => void;
  selectHardware: (id: string | null) => void;
  setMotionScan: (result: MotionScanResult | null) => void;
  setHovered: (id: PartId | null) => void;
  setHoveredFace: (ref: FaceRef | null) => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setSnap: (snap: Partial<SnapSettings>) => void;
  setNudgeStep: (step: number) => void;
  setViewOption: <K extends keyof ViewOptions>(key: K, value: ViewOptions[K]) => void;

  startFaceSnap: () => void;
  pickFace: (ref: FaceRef) => void;
  setFaceSnapGap: (gap: number) => void;
  setFaceSnapCenterAlign: (value: boolean) => void;
  resetFaceSnapPicks: () => void;
  cancelFaceSnap: () => void;

  setOperationDraft: (draft: OperationDraft | null) => void;
  updateOperationDraft: (patch: (draft: OperationDraft) => OperationDraft) => void;

  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
  setBomOpen: (open: boolean) => void;
  setInterference: (result: InterferencePair[] | null) => void;

  /** 履歴操作後に、消えた部材への参照を掃除する */
  reconcile: (aliveIds: readonly PartId[]) => void;
}

let toastSeq = 0;

export const useEditorStore = create<EditorStore>((set, get) => ({
  workspace: 'edit',
  createCategory: 'wood',
  mode: 'create',
  selectedIds: [],
  selectedJointId: null,
  selectedHardwareId: null,
  placement: IDLE_PLACEMENT,
  placementOptions: { presetId: 'hinge.concealed.35', quantity: 2, autoHoles: true, snapToMount: true, latchAt: 'auto' },
  motionScan: null,
  hoveredId: null,
  hoveredFace: null,
  gizmoMode: 'translate',
  snap: { ...DEFAULT_SNAP },
  nudgeStep: 1,
  faceSnap: null,
  operationDraft: null,
  viewOptions: { grid: true, shadows: true },
  toasts: [],
  bomOpen: false,
  interference: null,
  hintOverride: null,

  setWorkspace: (workspace) => set({
    workspace,
    faceSnap: null,
    hoveredFace: null,
    operationDraft: null,
    placement: IDLE_PLACEMENT,
  }),
  setCreateCategory: (createCategory) => set({ createCategory, selectedHardwareId: null, placement: IDLE_PLACEMENT }),
  setMode: (mode) => set({ mode, faceSnap: null, hoveredFace: null, operationDraft: null, placement: IDLE_PLACEMENT }),

  setPlacement: (patch) => set((s) => ({ placement: { ...s.placement, ...patch }, faceSnap: patch.step ? null : s.faceSnap })),
  setPlacementOptions: (patch) => set((s) => ({ placementOptions: { ...s.placementOptions, ...patch } })),
  cancelPlacement: () => set({ placement: IDLE_PLACEMENT, hoveredFace: null }),

  select: (ids, additive = false) =>
    set((s) => ({ selectedIds: additive ? [...new Set([...s.selectedIds, ...ids])] : ids })),

  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),

  clearSelection: () => set({ selectedIds: [] }),
  selectJoint: (selectedJointId) => set({ selectedJointId, motionScan: null }),
  selectHardware: (selectedHardwareId) => set({ selectedHardwareId }),

  setMotionScan: (motionScan) => set({ motionScan }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setHoveredFace: (hoveredFace) => set({ hoveredFace }),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setSnap: (snap) => set((s) => ({ snap: { ...s.snap, ...snap } })),
  setNudgeStep: (nudgeStep) => set({ nudgeStep }),
  setViewOption: (key, value) => set((s) => ({ viewOptions: { ...s.viewOptions, [key]: value } })),

  startFaceSnap: () => set({ faceSnap: { source: null, target: null, gap: 0, centerAlign: false }, hoveredFace: null }),

  pickFace: (ref) => {
    const session = get().faceSnap;
    if (!session) return;
    if (!session.source) {
      set({ faceSnap: { ...session, source: ref } });
      return;
    }
    if (ref.partId === session.source.partId) {
      get().pushToast('warning', '同じ部材の面どうしはスナップできません');
      return;
    }
    set({ faceSnap: { ...session, target: ref } });
  },

  setFaceSnapGap: (gap) => set((s) => (s.faceSnap ? { faceSnap: { ...s.faceSnap, gap } } : {})),
  setFaceSnapCenterAlign: (centerAlign) =>
    set((s) => (s.faceSnap ? { faceSnap: { ...s.faceSnap, centerAlign } } : {})),
  resetFaceSnapPicks: () => set((s) => (s.faceSnap ? { faceSnap: { ...s.faceSnap, source: null, target: null } } : {})),
  cancelFaceSnap: () => set({ faceSnap: null, hoveredFace: null }),

  setOperationDraft: (operationDraft) => set({ operationDraft }),
  updateOperationDraft: (patch) =>
    set((s) => (s.operationDraft ? { operationDraft: patch(s.operationDraft) } : {})),

  pushToast: (kind, message) => {
    toastSeq += 1;
    const id = toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    if (kind !== 'error') {
      setTimeout(() => get().dismissToast(id), 4000);
    }
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setBomOpen: (bomOpen) => set({ bomOpen, interference: bomOpen ? null : get().interference }),
  setInterference: (interference) => set({ interference, bomOpen: interference ? false : get().bomOpen }),

  reconcile: (aliveIds) => {
    const alive = new Set(aliveIds);
    const s = get();
    const selectedIds = s.selectedIds.filter((id) => alive.has(id));
    const hoveredId = s.hoveredId && alive.has(s.hoveredId) ? s.hoveredId : null;
    const hoveredFace = s.hoveredFace && alive.has(s.hoveredFace.partId) ? s.hoveredFace : null;
    const faceSnap =
      s.faceSnap &&
      ((s.faceSnap.source && !alive.has(s.faceSnap.source.partId)) ||
        (s.faceSnap.target && !alive.has(s.faceSnap.target.partId)))
        ? { ...s.faceSnap, source: null, target: null }
        : s.faceSnap;
    const operationDraft = s.operationDraft && !alive.has(s.operationDraft.partId) ? null : s.operationDraft;
    const placement = (s.placement.base && !alive.has(s.placement.base.partId))
      || (s.placement.moving && !alive.has(s.placement.moving.partId))
      ? IDLE_PLACEMENT
      : s.placement;
    if (
      selectedIds.length === s.selectedIds.length &&
      hoveredId === s.hoveredId &&
      hoveredFace === s.hoveredFace &&
      faceSnap === s.faceSnap &&
      operationDraft === s.operationDraft &&
      placement === s.placement
    ) {
      return;
    }
    set({ selectedIds, hoveredId, hoveredFace, faceSnap, operationDraft, placement });
  },
}));

export const isFaceSelected = (session: FaceSnapSession | null, partId: PartId, face: AxisDirection): boolean =>
  !!session &&
  ((session.source?.partId === partId && session.source.face === face) ||
    (session.target?.partId === partId && session.target.face === face));

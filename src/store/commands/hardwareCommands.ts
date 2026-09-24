import { createGasSpringId, createHardwareId, createJointId } from '../../core/ids';
import { hardwareOperations } from '../../core/hardware/hardwareOperations';
import {
  bracketLayout,
  faceNormals,
  faceVector,
  hardwarePartIds,
  hingeLayout,
  jointFromHardware,
  latchFrame,
  linearLayout,
  movingAnchorAt,
  movingSubtree,
  railLayout,
  restOffset,
  solveGasMount,
  strikerRestPoint,
  type GasBalanceInput,
  type MountFaces,
} from '../../core/hardware/mechanism';
import { latchValue } from '../../core/motion/limits';
import { buildMotionModel } from '../../core/motion/dynamics';
import { gasLimitedRange, gasStaticForce, resolveGasSpec } from '../../core/motion/gasSpring';
import { canAddJoint } from '../../core/motion/jointValidate';
import { bracketGroup, motionJoints, rebuildBracketJoints } from '../../core/hardware/brackets';
import { applyMat3, matrixFromColumns, matrixToEuler, multiply, rotationMatrix } from '../../core/math/matrix';
import { applyRigid, invertRigid, rigidFromTransform } from '../../core/math/rigid';
import { add, dot, length, normalize, scale, sub } from '../../core/math/vec3';
import type {
  GasSpringMount,
  GasSpringSpec,
  Hardware,
  HardwareId,
  HardwarePreset,
  Joint,
  Operation,
  MovableJoint,
  Part,
  PartId,
  Project,
  Vec3,
} from '../../core/types';
import { isMovableJoint } from '../../core/types';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

export interface AddHardwareInput {
  preset: HardwarePreset;
  basePartId: PartId;
  movingPartId: PartId;
  /** 省略すると、部材の配置から金物の位置と向きを自動で決める */
  position?: Vec3;
  rotation?: Vec3;
  quantity?: number;
  autoHoles?: boolean;
  /** ドアロックが掛かる端。省略時は直進なら動ききった端、回転なら閉じた位置 */
  latchAt?: 'min' | 'max';
  /** ガイド・レールの厚みに合わせて動く側を寄せる（既定 true） */
  snapToMount?: boolean;
  /** 金物を付ける面。選んでいれば、位置と向きをその面から決める（設計書 DESIGN_V2 §10.6） */
  faces?: MountFaces;
  /** 面の上で置いた位置。あれば自動の位置決めより優先する（設計書 DESIGN_V2 §10.7） */
  points?: PlacementPoints;
}

export interface PlacementPoints {
  /** 固定側の面の上の点（固定側ローカル mm）。レール・ガイドの中心、丁番・金具の位置、ガスの下端、ロックの受け */
  base: Vec3;
  /** 動く側の面の上の点（動く側ローカル mm）。ガススプリングの上端だけが使う */
  moving?: Vec3;
  /** レール・ガイドの向きを面の中で 90° 回す */
  turn?: boolean;
  /** レール・ガイドの向きを反対にする */
  flip?: boolean;
}

/** ガススプリングのブラケットが取付面から出る長さ mm */
const BRACKET_STANDOFF = 15;

export interface HardwarePlan {
  /** 取り付けたあとのプロジェクト */
  next: Project;
  hardwareId: HardwareId;
  /** 金物の厚みに合わせて寄せた部材 */
  moved: PartId[];
  messages: Array<['success' | 'warning', string]>;
  /** 金具で固定側へつないでしまい、動かなくなった箇所 */
  conflicts: string[];
  targetJointId: string | null;
}

/** 選んだ 2 面が、その金物を付けられる向きか */
function faceProblem(preset: HardwarePreset, base: Part, moving: Part, faces: MountFaces): string | null {
  const normals = faceNormals(base, moving, faces);
  const facing = dot(normals.base, normals.moving);
  if (preset.kind === 'slideRail' || preset.kind === 'linearGuide') {
    if (facing > -0.9) return `選んだ 2 つの面が向かい合っていません。${base.name} の面と、それに向き合う ${moving.name} の面を選んでください`;
  }
  if (preset.kind === 'bracket' && Math.abs(facing) > 0.2) {
    return 'L字金具は、直角に交わる 2 つの面（内側の角をつくる面）に付けます';
  }
  return null;
}

/** 2 部材のワールドの外接箱が 1mm 以内で触れているか */
function partsTouch(a: Part, b: Part): boolean {
  const box = (part: Part): { min: Vec3; max: Vec3 } => {
    const r = rotationMatrix(part.transform.rotation);
    const h: Vec3 = [part.size.x / 2, part.size.y / 2, part.size.z / 2];
    const extent = [0, 1, 2].map((i) => Math.abs(r[i * 3]!) * h[0] + Math.abs(r[i * 3 + 1]!) * h[1] + Math.abs(r[i * 3 + 2]!) * h[2]);
    const c = part.transform.position;
    return { min: [c[0] - extent[0]!, c[1] - extent[1]!, c[2] - extent[2]!], max: [c[0] + extent[0]!, c[1] + extent[1]!, c[2] + extent[2]!] };
  };
  const p = box(a);
  const q = box(b);
  return [0, 1, 2].every((i) => p.min[i]! <= q.max[i]! + 1 && q.min[i]! <= p.max[i]! + 1);
}

/**
 * ガイド・レールは、固定側の面と動く側の面の間に挟まる。
 * 間が金物の厚み（mountGap）と違えば、動く側と、それに金具で付いた部材を取付面の法線方向へ動かす。
 * ガイドが動く側の幅の外に来るときは付けられない。
 */
function snapToMount(project: Project, preset: HardwarePreset, base: Part, moving: Part, faces?: MountFaces): { project: Project; moved: PartId[]; shift: number } | { error: string } | null {
  if (preset.mountGap === undefined || (preset.kind !== 'linearGuide' && preset.kind !== 'slideRail')) return null;
  if (motionJoints(project.joints).some((joint) => joint.movingPartId === moving.id)) return null;
  const layout = preset.kind === 'slideRail' ? railLayout(base, moving, preset, faces) : linearLayout(base, moving, preset, faces);
  const frame = rotationMatrix(layout.rotation);
  const normal = applyMat3(frame, [0, 0, 1]);
  const lateralDir = applyMat3(frame, [0, 1, 0]);
  const offset = restOffset(base, moving);
  const h: Vec3 = [moving.size.x / 2, moving.size.y / 2, moving.size.z / 2];
  const corners: Vec3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(applyRigid(offset, [sx * h[0], sy * h[1], sz * h[2]]));
  const gap = Math.min(...corners.map((corner) => dot(sub(corner, layout.position), normal)));
  if (preset.kind === 'linearGuide') {
    // ブロック（幅 34mm）が動く側の面に載るか
    const lateral = corners.map((corner) => dot(sub(corner, layout.position), lateralDir));
    const width = Math.max(...lateral) - Math.min(...lateral);
    if (width < 30) {
      return { error: `${base.name} に向いている ${moving.name} の面の幅（${Math.round(width)}mm）が、ガイドのブロック（34mm）より狭いため留められません。広い面を ${base.name} に向けてください` };
    }
    if (Math.min(...lateral) > -10 || Math.max(...lateral) < 10) {
      return { error: `${moving.name} が ${base.name} の正面にないため、ガイドのブロックを留められません。${moving.name} を ${base.name} の前へ移動してください` };
    }
  }
  const shift = preset.mountGap - gap;
  if (Math.abs(shift) < 0.5) return null;
  const worldShift = applyMat3(rotationMatrix(base.transform.rotation), scale(normal, shift));
  // 一緒に寄せる部材: 金具で付いた部材と、動く側に接している部材（固定側に接しているものは除く）
  const group = bracketGroup(project, moving.id, base.id);
  const motionParts = new Set(motionJoints(project.joints).flatMap((joint) => [joint.movingPartId]));
  for (const part of project.parts) {
    if (group.has(part.id) || part.id === base.id || motionParts.has(part.id)) continue;
    if (partsTouch(part, moving) && !partsTouch(part, base)) group.add(part.id);
  }
  const parts = project.parts.map((part) => (group.has(part.id)
    ? { ...part, transform: { ...part.transform, position: add(part.transform.position, worldShift) } }
    : part));
  return { project: { ...project, parts }, moved: [...group], shift };
}

const toast = (kind: 'success' | 'warning' | 'error', message: string): void =>
  useEditorStore.getState().pushToast(kind, message);

/** 金物 1 つぶんの穴を、部材ごとに付け直す（note = hardwareId の加工を入れ替える） */
function replaceHoles(draft: Project, hardwareId: HardwareId, operations: Map<PartId, Operation[]>): void {
  for (const part of draft.parts) {
    part.operations = part.operations.filter((operation) => operation.note !== hardwareId);
    part.operations.push(...(operations.get(part.id) ?? []));
  }
}

const hasAutoHoles = (project: Project, hardwareId: HardwareId): boolean =>
  project.parts.some((part) => part.operations.some((operation) => operation.note === hardwareId));

function holesFor(project: Project, hardware: Hardware, mount?: GasSpringMount): Map<PartId, Operation[]> {
  const parts = hardwarePartIds(project, hardware);
  if (!parts) return new Map();
  return hardwareOperations(hardware, project, parts.base, parts.moving, mount);
}

/** 可動を作る金物（これが 1 つも無い可動は存在できない）。固定金具は可動を作らない */
const DRIVER_KINDS = new Set<HardwarePreset['kind']>(['hinge', 'slideRail', 'linearGuide']);

/** 丁番・レール・リニアガイドを、部材の配置に合わせて置いたときの金物と joint */
function placeMotionHardware(
  preset: HardwarePreset,
  base: Part,
  moving: Part,
  existing: Joint | undefined,
  quantity: number,
  position?: Vec3,
  rotation?: Vec3,
  faces?: MountFaces,
  points?: PlacementPoints,
): { hardware: Hardware; joint: Joint } | { error: string } {
  const range = preset.defaultRange ? { ...preset.defaultRange } : { min: 0, max: 110 };
  const parts = { base: base.id, moving: moving.id };
  const name = `${base.name} - ${moving.name}`;
  let hardware: Hardware;
  let joint: Joint;
  if (preset.kind === 'slideRail' || preset.kind === 'linearGuide') {
    const auto = preset.kind === 'slideRail' ? railLayout(base, moving, preset, faces) : linearLayout(base, moving, preset, faces);
    const layout = points ? placedRailLayout(auto, points) : auto;
    hardware = { id: createHardwareId(), preset, jointId: null, position: position ?? layout.position, rotation: rotation ?? layout.rotation, quantity, parts, ...(faces ? { faces } : {}) };
    if (points && preset.kind === 'linearGuide') {
      // ブロックは、動く側の面の中心の高さでレールに載る。そこが可動量 0。上下にどれだけ動けるかはレール上の位置で決まる
      const travel = (preset.railLength ?? 500) - (preset.blockLength ?? 60);
      const dir = applyMat3(rotationMatrix(layout.rotation), [1, 0, 0]);
      const blockCenter = dot(sub(restOffset(base, moving).translation, layout.position), dir);
      const offset = blockCenter + (preset.railLength ?? 500) / 2 - (preset.blockLength ?? 60) / 2;
      if (offset < -1 || offset > travel + 1) {
        return { error: `レールがブロックの位置（${moving.name} の中心の高さ）に届いていません。レールを ${Math.round(offset < 0 ? -offset : offset - travel)}mm ずらしてください` };
      }
      hardware.travelOffset = Math.min(Math.max(offset, 0), travel);
    }
    joint = existing ?? {
      id: createJointId(), name, enabled: true, kind: 'prismatic',
      basePartId: base.id, movingPartId: moving.id, axis: layout.axis, value: 0, range,
    };
  } else {
    const layout = hingeLayout(base, moving, faces);
    // 置いた点はピンの線の上へ（丁番の高さだけを決める）
    const pin = applyMat3(rotationMatrix(layout.rotation), [0, 1, 0]);
    const origin = points ? add(layout.origin, scale(pin, dot(sub(points.base, layout.origin), pin))) : layout.origin;
    hardware = { id: createHardwareId(), preset, jointId: null, position: position ?? origin, rotation: rotation ?? layout.rotation, quantity, parts, ...(faces ? { faces } : {}) };
    joint = existing ?? {
      id: createJointId(), name, enabled: true, kind: 'revolute',
      basePartId: base.id, movingPartId: moving.id, origin: layout.origin, axis: layout.axis, value: 0, range,
    };
  }
  hardware.jointId = joint.id;
  // 新しく作る joint は、金物の向きから作り直す（丁番のピン = 回転軸、レール・ガイドの長さ方向 = 動く向き）
  if (!existing) joint = jointFromHardware(hardware, joint);
  return { hardware, joint };
}

/** 置いた点と向きで、レール・ガイドの位置と姿勢を置き換える（取付面と法線はそのまま） */
function placedRailLayout(auto: { position: Vec3; rotation: Vec3; axis: Vec3 }, points: PlacementPoints): { position: Vec3; rotation: Vec3; axis: Vec3 } {
  const frame = rotationMatrix(auto.rotation);
  let x = applyMat3(frame, [1, 0, 0]);
  let y = applyMat3(frame, [0, 1, 0]);
  const z = applyMat3(frame, [0, 0, 1]);
  if (points.turn) [x, y] = [y, scale(x, -1)];
  if (points.flip) [x, y] = [scale(x, -1), scale(y, -1)];
  // 置いた点を取付面の上へ
  const position = sub(points.base, scale(z, dot(sub(points.base, auto.position), z)));
  return { position, rotation: matrixToEuler(matrixFromColumns(x, y, z)), axis: x };
}

/** 押し出し型・ロック付の丁番は、重さとのつり合いも見て取付位置を選ぶ */
function balanceFor(project: Project, joint: MovableJoint, spec: GasSpringSpec, quantity: number): GasBalanceInput | undefined {
  const type = spec.type ?? 'push';
  if (joint.kind !== 'revolute' || (type !== 'push' && type !== 'locking')) return undefined;
  const model = buildMotionModel({ ...project, joints: project.joints.map((item) => item.id === joint.id ? { ...joint, value: 0 } : item), gasSprings: project.gasSprings.filter((item) => item.jointId !== joint.id) }, joint.id);
  if (!model) return undefined;
  const resolved = resolveGasSpec(spec);
  return { quantity, gravityTorque: (deg) => model.staticLoad(deg).gravity, force: (length) => gasStaticForce(resolved, length) };
}

/** ロッドを下向きにする端。動ききった状態で低い方の取付点にロッドを付ける */
function rodEndFor(project: Project, joint: MovableJoint, mount: GasSpringMount): 'base' | 'moving' {
  const base = project.parts.find((part) => part.id === joint.basePartId);
  const moving = project.parts.find((part) => part.id === joint.movingPartId);
  if (!base || !moving) return 'moving';
  const baseWorld = rigidFromTransform(base.transform);
  const movingRest = applyRigid(restOffset(base, moving), mount.movingAnchor);
  const open = applyRigid(baseWorld, movingAnchorAt(joint, movingRest, joint.range.max));
  const fixed = applyRigid(baseWorld, mount.baseAnchor);
  return open[1] < fixed[1] ? 'moving' : 'base';
}

const unitLabel = (joint: MovableJoint): string => (joint.kind === 'revolute' ? '°' : 'mm');

/**
 * 金物を付けたらどうなるかを計算する（副作用なし）。
 * 取り付けのプレビュー（透過表示）と実際の取り付けは、どちらもこの結果を使う。
 */
export function planHardware(source: Project, input: AddHardwareInput): HardwarePlan | { error: string } {
  const foundBase = source.parts.find((part) => part.id === input.basePartId);
  const foundMoving = source.parts.find((part) => part.id === input.movingPartId);
  if (!foundBase || !foundMoving || foundBase.id === foundMoving.id) return { error: '金物を取り付ける部材が見つかりません' };
  let base: Part = foundBase;
  let moving: Part = foundMoving;
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const autoHoles = input.autoHoles !== false;
  const parts = { base: base.id, moving: moving.id };
  const faces = input.faces;
  const points = input.points;
  if (faces) {
    const problem = faceProblem(input.preset, base, moving, faces);
    if (problem) return { error: problem };
  }

  // ガイド・レールは金物の厚みぶん離して付ける。離れていたり食い込んでいたら、動く側（と金具で付いた部材）を寄せる
  const snap = input.snapToMount === false ? null : snapToMount(source, input.preset, base, moving, faces);
  if (snap && 'error' in snap) return { error: snap.error };
  const project = snap ? snap.project : source;
  if (snap) {
    base = project.parts.find((part) => part.id === base.id)!;
    moving = project.parts.find((part) => part.id === moving.id)!;
  }

  const motion = motionJoints(project.joints);
  const subtreeOf = (joint: MovableJoint): Set<PartId> => movingSubtree(project, joint.movingPartId);
  const inMotion = (partId: PartId): boolean => motion.some((joint) => subtreeOf(joint).has(partId));
  const nameOf = (id: PartId): string => project.parts.find((part) => part.id === id)?.name ?? '?';
  const fail = (message: string): { error: string } => ({ error: message });
  /**
   * ガススプリング・ドアロックが補助する動き。
   * 選んだ「動く側」を動かしている可動（金具で一緒に動く部材を含む）のうち、
   * 選んだ「固定側」は動かさないもの。いちばん内側の可動を選ぶ。
   */
  const resolveDriver = (): MovableJoint | undefined => motion
    .filter((joint) => subtreeOf(joint).has(moving.id) && !subtreeOf(joint).has(base.id))
    .sort((a, b) => subtreeOf(a).size - subtreeOf(b).size)[0];
  /** 選んだ部材のローカル点を、別の部材のローカルへ（どちらも rest pose） */
  const toLocalOf = (from: Part, to: Part, point: Vec3): Vec3 => applyRigid(restOffset(to, from), point);

  const newHardware: Hardware[] = [];
  let newJoint: Joint | null = null;
  let mount: GasSpringMount | null = null;
  let mainHardware: Hardware;
  let targetJoint: Joint | null;
  const messages: Array<['success' | 'warning', string]> = [];

  if (input.preset.kind === 'gasSpring') {
    const spec = input.preset.gasSpring;
    if (!spec) return fail('ガススプリングの仕様がありません');
    const driven = resolveDriver();
    if (!driven) {
      return fail(inMotion(moving.id)
        ? `${moving.name} と ${base.name} は一緒に動くので、間にガススプリングを付けても働きません`
        : `${moving.name} はまだ動きません。ガススプリングは動きを補助する部品なので、先に丁番・レール・リニアガイドを付けてください`);
    }
    targetJoint = driven;
    const driverBase = project.parts.find((part) => part.id === driven.basePartId)!;
    const driverMoving = project.parts.find((part) => part.id === driven.movingPartId)!;
    let anchors: { baseAnchor: Vec3; movingAnchor: Vec3 } | null;
    if (points?.moving && faces) {
      // 置いた 2 点から、ブラケットの厚みだけ面から離した位置が取付点
      const baseAnchor = toLocalOf(base, driverBase, add(points.base, scale(faceVector(faces.base), BRACKET_STANDOFF)));
      const movingAnchor = toLocalOf(moving, driverMoving, add(points.moving, scale(faceVector(faces.moving), BRACKET_STANDOFF)));
      const offset = restOffset(driverBase, driverMoving);
      const now = length(sub(movingAnchorAt(driven, applyRigid(offset, movingAnchor), driven.value), baseAnchor));
      if (now < spec.strokeMin - 0.5 || now > spec.strokeMax + 0.5) {
        return fail(`取付点の間が ${Math.round(now)}mm です。このガススプリングは ${spec.strokeMin}〜${spec.strokeMax}mm の間でしか付けられません`);
      }
      anchors = { baseAnchor, movingAnchor };
    } else {
      const solved = solveGasMount(project, driven, spec, driven.range.max, balanceFor(project, driven, spec, quantity));
      anchors = solved ? { baseAnchor: solved.baseAnchor, movingAnchor: solved.movingAnchor } : null;
      if (!solved) {
        messages.push(['warning', driven.kind === 'prismatic'
          ? `ガススプリングの下端を留める場所がありません。縮んだ長さ（${spec.strokeMin}mm）ぶん下に、柱や床板など動かない部材が必要です`
          : '伸縮範囲が合わず、取付位置が見つかりません。短いガススプリングを選んでください']);
      } else if (!solved.reachesTarget) {
        const reach = driven.kind === 'prismatic' ? `${Math.round(solved.openLength - solved.closedLength)}mm` : '途中';
        messages.push(['warning', `伸縮範囲の都合で、金物の最大（${driven.range.max}${unitLabel(driven)}）までは動きません（${reach}まで）`]);
      }
    }
    // 取付点は、実際に動きを作っている 2 部材の座標で持つ
    const driverParts = { base: driven.basePartId, moving: driven.movingPartId };
    mainHardware = { id: createHardwareId(), preset: input.preset, jointId: driven.id, position: [0, 0, 0], rotation: [0, 0, 0], quantity, parts: driverParts };
    mount = {
      id: createGasSpringId(), hardwareId: mainHardware.id, jointId: driven.id,
      baseAnchor: anchors?.baseAnchor ?? [0, 0, 0],
      movingAnchor: anchors?.movingAnchor ?? [0, 0, 0],
      ...spec,
    };
    mount.rodEnd = rodEndFor(project, driven, mount);
    mainHardware.position = mount.baseAnchor;
    if (points?.moving) {
      const range = gasLimitedRange({ ...project, gasSprings: [...project.gasSprings, mount] }, driven);
      messages.push(['success', `この位置なら ${Math.round(range.min)}〜${Math.round(range.max)}${unitLabel(driven)} 動きます${range.maxReason ? `（${range.maxReason}で止まる）` : ''}`]);
    }
  } else if (input.preset.kind === 'latch') {
    const driven = resolveDriver();
    if (!driven) return fail('ドアロックは、丁番・レール・リニアガイドで動く部材と、動かない部材の間に付けます');
    targetJoint = driven;
    const driverBase = project.parts.find((part) => part.id === driven.basePartId)!;
    const driverMoving = project.parts.find((part) => part.id === driven.movingPartId)!;
    const at = input.latchAt ?? (driven.kind === 'prismatic' ? 'max' : 'min');
    const lock = latchValue(project, driven, at);
    let striker = strikerRestPoint(driverBase, driverMoving, driven, at);
    if (points) {
      // 受け金具を置いた位置に、ロック位置でストライカーが来る。可動量 0 のときのストライカーはそこから逆にたどる
      const catchPoint = toLocalOf(base, driverBase, points.base);
      striker = movingAnchorAt(driven, catchPoint, -lock);
      const world = applyRigid(rigidFromTransform(driverBase.transform), striker);
      const reachable = project.parts.filter((part) => subtreeOf(driven).has(part.id)).some((part) => {
        const local = applyRigid(invertRigid(rigidFromTransform(part.transform)), world);
        const h: Vec3 = [part.size.x / 2, part.size.y / 2, part.size.z / 2];
        return [0, 1, 2].every((i) => Math.abs(local[i]!) <= h[i]! + 30);
      });
      if (!reachable) return fail(`ロック位置まで動いても、${moving.name} がこの受け金具に届きません。動く部材の通り道に置いてください`);
    }
    const frame = latchFrame(driven, striker, lock, at);
    mainHardware = {
      id: createHardwareId(), preset: input.preset, jointId: driven.id, position: frame.position, rotation: frame.rotation, quantity,
      parts: { base: driven.basePartId, moving: driven.movingPartId },
      // 掛かっているかどうかは動作確認の中の状態。設計データでは常に外れている
      latch: { at, engaged: false },
    };
  } else if (input.preset.kind === 'bracket') {
    // 固定金具は joint を直接作らない。どちら向きに付けても、動く部材につながった側が一緒に動く（brackets.ts）
    const layout = bracketLayout(base, moving, faces);
    let position = input.position ?? layout.position;
    if (points) {
      // 角に沿う方向の位置だけ、置いた点に合わせる
      const along = applyMat3(rotationMatrix(layout.rotation), [0, 0, 1]);
      position = add(layout.position, scale(along, dot(sub(points.base, layout.position), along)));
    }
    targetJoint = null;
    mainHardware = {
      id: createHardwareId(), preset: input.preset, jointId: null,
      position, rotation: input.rotation ?? layout.rotation, quantity, parts,
      ...(faces ? { faces } : {}),
    };
  } else {
    const kindLabel = { revolute: '丁番', prismatic: 'レール・リニアガイド' } as const;
    const current = motion.find((joint) => joint.movingPartId === moving.id);
    let existing: MovableJoint | undefined;
    if (current) {
      if (current.kind !== input.preset.jointKind) {
        return fail(`${moving.name} はすでに${kindLabel[current.kind]}で動くため、${input.preset.label}を足すと動けなくなります`);
      }
      if (current.basePartId !== base.id && (inMotion(base.id) || inMotion(current.basePartId))) {
        return fail(`${moving.name} は ${nameOf(current.basePartId)} に対して動いています。固定側には動かない部材を選んでください`);
      }
      existing = current;
    } else if (inMotion(moving.id)) {
      return fail(`${moving.name} は固定金具で動く部材に固定されています。動かすには、先にその固定金具を外してください`);
    }
    const placed = placeMotionHardware(input.preset, base, moving, existing, quantity, input.position, input.rotation, faces, points);
    if ('error' in placed) return fail(placed.error);
    if (existing && existing.basePartId !== base.id) {
      // 別の固定部材に付ける 2 本目（左右の柱にリニアガイド、左右の側板にレールなど）。
      // 同じ向き・同じ線上でないと、実物では引っかかって動かない
      const problem = parallelProblem(project, placed.hardware, existing);
      if (problem) return fail(problem);
    }
    mainHardware = placed.hardware;
    targetJoint = placed.joint;
    if (!existing) newJoint = placed.joint;
  }

  if (newJoint) {
    const check = canAddJoint(motion, newJoint, project.parts);
    if (!check.ok) return fail(check.reason ?? 'この金物は取り付けられません');
  }
  newHardware.push(mainHardware);

  const draftNext: Project = {
    ...project,
    joints: newJoint ? [...motion, newJoint] : motion,
    hardware: [...project.hardware, ...newHardware],
    gasSprings: mount ? [...project.gasSprings, mount] : project.gasSprings,
  };
  const synced = rebuildBracketJoints(draftNext);
  let next: Project = { ...draftNext, joints: synced.joints };
  if (autoHoles) {
    for (const item of newHardware) next = { ...next, parts: withHoles(next.parts, item.id, holesFor(next, item, item.id === mount?.hardwareId ? mount : undefined)) };
  }
  const before = new Set(rebuildBracketJoints(source).conflicts);
  const movedNames = snap ? snap.moved.filter((id) => id !== moving.id).map((id) => project.parts.find((part) => part.id === id)?.name ?? '?') : [];
  if (snap) messages.unshift(['success', `${moving.name}${movedNames.length > 0 ? `（と ${movedNames.join('・')}）` : ''}を、${input.preset.label}の厚み（${input.preset.mountGap}mm）ぶん${base.name}から離れた位置へ${Math.abs(snap.shift) > 0.5 ? `${Math.round(Math.abs(snap.shift))}mm 寄せました` : 'そろえました'}`]);
  return {
    next,
    hardwareId: mainHardware.id,
    moved: snap?.moved ?? [],
    messages,
    conflicts: synced.conflicts.filter((conflict) => !before.has(conflict)),
    targetJointId: targetJoint && isMovableJoint(targetJoint) ? targetJoint.id : null,
  };
}

/** 金物 1 つぶんの穴を付け直した部材の配列（note = hardwareId の加工を入れ替える） */
function withHoles(parts: readonly Part[], hardwareId: HardwareId, operations: Map<PartId, Operation[]>): Part[] {
  return parts.map((part) => {
    const kept = part.operations.filter((operation) => operation.note !== hardwareId);
    const added = operations.get(part.id) ?? [];
    return kept.length === part.operations.length && added.length === 0 ? part : { ...part, operations: [...kept, ...added] };
  });
}

export function addHardware(input: AddHardwareInput): HardwareId | null {
  const state = useProjectStore.getState();
  const plan = planHardware(state.project, input);
  if ('error' in plan) {
    toast('warning', plan.error);
    return null;
  }
  const { next } = plan;
  state.applyCommand(`${input.preset.label}を取り付け`, (draft) => {
    draft.parts = next.parts as typeof draft.parts;
    draft.joints = next.joints as typeof draft.joints;
    draft.hardware = next.hardware as typeof draft.hardware;
    draft.gasSprings = next.gasSprings as typeof draft.gasSprings;
  });
  for (const [kind, message] of plan.messages) toast(kind, message);
  for (const conflict of plan.conflicts) toast('warning', conflict);
  if (plan.targetJointId) useEditorStore.getState().selectJoint(plan.targetJointId);
  return plan.hardwareId;
}

/** 別の固定部材に付けた 2 本目の金物が、既存の動きと同じ向き（回転なら同じ軸線上）か */
function parallelProblem(project: Project, hardware: Hardware, joint: MovableJoint): string | null {
  const jointBase = project.parts.find((part) => part.id === joint.basePartId);
  const hardwareBase = project.parts.find((part) => part.id === hardware.parts?.base);
  if (!jointBase || !hardwareBase) return null;
  const toJoint = restOffset(jointBase, hardwareBase);
  const converted = jointFromHardware({ ...hardware, position: applyRigid(toJoint, hardware.position), rotation: matrixToEuler(multiply(toJoint.rotation, rotationMatrix(hardware.rotation))) }, joint);
  if (!isMovableJoint(converted)) return null;
  if (Math.abs(dot(normalize(converted.axis), normalize(joint.axis))) < 0.99) {
    return `${hardware.preset.label}の向きが、すでに付いている金物とそろっていません。向きがそろわないと実物では動きません`;
  }
  if (joint.kind === 'revolute' && converted.kind === 'revolute') {
    const offset = sub(converted.origin, joint.origin);
    const axis = normalize(joint.axis);
    if (length(sub(offset, scale(axis, dot(offset, axis)))) > 2) return '回転軸が、すでに付いている丁番と同じ線上にありません';
  }
  return null;
}

/**
 * 金物を外す。可動を作っていた最後の金物なら、その可動も一緒に消える。
 * 可動が消えると、そこに付いていたガススプリングとドアロックも支えを失うので外れる。
 */
export function removeHardware(hardwareId: HardwareId): void {
  const project = useProjectStore.getState().project;
  const hardware = project.hardware.find((item) => item.id === hardwareId);
  if (!hardware) return;
  const jointId = hardware.jointId;
  const remainingDrivers = project.hardware.filter((item) =>
    item.id !== hardwareId && item.jointId === jointId && DRIVER_KINDS.has(item.preset.kind));
  const dropJoint = jointId !== null && DRIVER_KINDS.has(hardware.preset.kind) && remainingDrivers.length === 0;
  const orphans = dropJoint
    ? project.hardware.filter((item) => item.jointId === jointId && !DRIVER_KINDS.has(item.preset.kind)).map((item) => item.id)
    : [];
  const removed = new Set([hardwareId, ...orphans]);
  const next: Project = {
    ...project,
    hardware: project.hardware.filter((item) => !removed.has(item.id)),
    joints: dropJoint ? project.joints.filter((joint) => joint.id !== jointId) : project.joints,
  };
  const joints = rebuildBracketJoints({ ...next, joints: motionJoints(next.joints) }).joints;
  useProjectStore.getState().applyCommand('金物を削除', (draft) => {
    draft.hardware = draft.hardware.filter((item) => !removed.has(item.id));
    draft.joints = joints;
    draft.gasSprings = draft.gasSprings.filter((spring) => !removed.has(spring.hardwareId));
    for (const part of draft.parts) part.operations = part.operations.filter((operation) => !operation.note || !removed.has(operation.note));
  });
}

/** ドアロックを掛ける / 外す（動作確認でレバーやボルトを操作するのに相当） */
export function setLatchEngaged(hardwareId: HardwareId, engaged: boolean): void {
  useProjectStore.getState().applyCommand(engaged ? 'ドアロックを掛ける' : 'ドアロックを外す', (draft) => {
    const target = draft.hardware.find((item) => item.id === hardwareId);
    if (target?.latch) target.latch.engaged = engaged;
  });
}

/**
 * 金物を動かす。丁番を動かせば回転軸が、レールを回せば引き出す向きが一緒に変わる。
 * 動きは金物から決まるので、joint を別に直す必要はない。
 */
export function moveHardware(hardwareId: HardwareId, position: Vec3, rotation?: Vec3): void {
  const project = useProjectStore.getState().project;
  const hardware = project.hardware.find((item) => item.id === hardwareId);
  const joint = hardware?.jointId ? project.joints.find((item) => item.id === hardware.jointId) : undefined;
  if (hardware && !joint && hardwarePartIds(project, hardware)) {
    // 可動を作らない固定金具（すでに別の可動で動く部材どうしなど）は、位置と穴だけ直す
    const moved: Hardware = { ...hardware, position, rotation: rotation ?? hardware.rotation };
    const holes = hasAutoHoles(project, hardwareId) ? holesFor(project, moved) : new Map<PartId, Operation[]>();
    useProjectStore.getState().applyCommand('金物を移動', (draft) => {
      const target = draft.hardware.find((item) => item.id === hardwareId);
      if (target) { target.position = position; target.rotation = moved.rotation; }
      replaceHoles(draft, hardwareId, holes);
    });
    return;
  }
  if (!hardware || !joint) return;
  if (hardware.preset.kind === 'gasSpring') {
    const mount = project.gasSprings.find((item) => item.hardwareId === hardwareId);
    if (mount) setGasAnchors(mount.id, position, mount.movingAnchor);
    return;
  }
  const moved: Hardware = { ...hardware, position, rotation: rotation ?? hardware.rotation };
  const primary = project.hardware.find((item) => item.jointId === joint.id && item.preset.kind === hardware.preset.kind
    && (item.parts?.base ?? joint.basePartId) === joint.basePartId);
  const drivesMotion = hardware.preset.kind === 'hinge' || hardware.preset.kind === 'slideRail' || hardware.preset.kind === 'linearGuide';
  const rebuilt = jointFromHardware(moved, joint);
  const nextJoint: Joint = primary?.id === hardwareId && drivesMotion && isMovableJoint(rebuilt) ? { ...rebuilt, value: 0 } : joint;
  const next: Project = {
    ...project,
    joints: project.joints.map((item) => item.id === joint.id ? nextJoint : item),
    hardware: project.hardware.map((item) => item.id === hardwareId ? moved : item),
  };
  const holes = hasAutoHoles(project, hardwareId) ? holesFor(next, moved) : new Map<PartId, Operation[]>();
  // 回転軸が動くとガススプリングの長さも変わるので、そちらの穴も付け直す
  const gasHoles = next.gasSprings.filter((mount) => mount.jointId === joint.id && hasAutoHoles(project, mount.hardwareId)).map((mount) => {
    const gasHardware = next.hardware.find((item) => item.id === mount.hardwareId)!;
    return [mount.hardwareId, holesFor(next, gasHardware, mount)] as const;
  });
  useProjectStore.getState().applyCommand('金物を移動', (draft) => {
    const target = draft.hardware.find((item) => item.id === hardwareId);
    if (target) { target.position = position; target.rotation = moved.rotation; }
    const index = draft.joints.findIndex((item) => item.id === joint.id);
    if (index >= 0) draft.joints[index] = nextJoint;
    replaceHoles(draft, hardwareId, holes);
    for (const [id, operations] of gasHoles) replaceHoles(draft, id, operations);
  });
}

/** レールの引き出す向きを前後反転する（取付面はそのまま、前端をそろえ直す） */
export function flipRailDirection(hardwareId: HardwareId): void {
  const project = useProjectStore.getState().project;
  const hardware = project.hardware.find((item) => item.id === hardwareId);
  const joint = project.joints.find((item) => item.id === hardware?.jointId);
  const base = project.parts.find((part) => part.id === joint?.basePartId);
  const moving = project.parts.find((part) => part.id === joint?.movingPartId);
  if (!hardware || hardware.preset.kind !== 'slideRail' || !base || !moving) return;
  const frame = rotationMatrix(hardware.rotation);
  const pull = applyMat3(frame, [1, 0, 0]);
  const center = restOffset(base, moving).translation;
  const along = dot(sub(center, hardware.position), pull);
  const position = add(hardware.position, scale(pull, 2 * along));
  // ローカル Z まわりに 180°: X と Y が反転し、取付面の法線 Z はそのまま
  const flipped = applyMat3(frame, [-1, 0, 0]);
  const up = applyMat3(frame, [0, -1, 0]);
  const normal = applyMat3(frame, [0, 0, 1]);
  const rotation = matrixToEuler(matrixFromColumns(flipped, up, normal));
  moveHardware(hardwareId, position, rotation);
}

/** ガススプリングの取付点を変える。可動側は扉ローカル */
export function setGasAnchors(mountId: string, baseAnchor: Vec3, movingAnchor: Vec3): void {
  const project = useProjectStore.getState().project;
  const mount = project.gasSprings.find((item) => item.id === mountId);
  const hardware = project.hardware.find((item) => item.id === mount?.hardwareId);
  const joint = project.joints.find((item) => item.id === mount?.jointId);
  if (!mount || !hardware || !joint || !isMovableJoint(joint)) return;
  const nextMount: GasSpringMount = { ...mount, baseAnchor, movingAnchor };
  nextMount.rodEnd = rodEndFor(project, joint, nextMount);
  const next: Project = { ...project, gasSprings: project.gasSprings.map((item) => item.id === mountId ? nextMount : item) };
  const holes = hasAutoHoles(project, hardware.id) ? holesFor(next, hardware, nextMount) : new Map<PartId, Operation[]>();
  useProjectStore.getState().applyCommand('ガススプリングの取付位置を変更', (draft) => {
    const index = draft.gasSprings.findIndex((item) => item.id === mountId);
    if (index >= 0) draft.gasSprings[index] = nextMount;
    const target = draft.hardware.find((item) => item.id === hardware.id);
    if (target) target.position = baseAnchor;
    replaceHoles(draft, hardware.id, holes);
  });
}

/** 取付位置を自動で決め直す */
export function autoPlaceGasSpring(mountId: string): void {
  const project = useProjectStore.getState().project;
  const mount = project.gasSprings.find((item) => item.id === mountId);
  const joint = project.joints.find((item) => item.id === mount?.jointId);
  if (!mount || !joint || !isMovableJoint(joint)) return;
  const quantity = project.hardware.find((item) => item.id === mount.hardwareId)?.quantity ?? 1;
  const others: Project = { ...project, gasSprings: project.gasSprings.filter((item) => item.id !== mountId) };
  const solved = solveGasMount(project, joint, mount, joint.range.max, balanceFor(others, joint, mount, quantity));
  if (!solved) {
    toast('warning', '伸縮範囲に合う取付位置が見つかりません');
    return;
  }
  setGasAnchors(mountId, solved.baseAnchor, solved.movingAnchor);
  if (!solved.reachesTarget) toast('warning', '伸縮範囲の都合で、金物の最大までは動きません');
}

/** ロック付ガススプリングのロック / 解除（ロッド先端のピンを押す操作に相当） */
export function setGasLocked(mountId: string, locked: boolean): void {
  useProjectStore.getState().applyCommand(locked ? 'ガススプリングをロック' : 'ロックを解除', (draft) => {
    const mount = draft.gasSprings.find((item) => item.id === mountId);
    if (mount) mount.locked = locked;
  });
}

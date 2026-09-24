import { useMemo, useState, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei/core/TransformControls';
import { Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from 'three';
import { gasAnchorPairs, hardwareInstances, hardwarePartIds, movingAnchorAt, restOffset } from '../core/hardware/mechanism';
import { latchValue } from '../core/motion/limits';
import { applyMat3, rotationMatrix } from '../core/math/matrix';
import { applyRigid, composeRigid, IDENTITY_RIGID, invertRigid, type Rigid } from '../core/math/rigid';
import { add, length, normalize, scale, sub } from '../core/math/vec3';
import { jointLocalRigid } from '../core/motion/kinematics';
import { isMovableJoint, type GasSpringMount, type Hardware, type Joint, type MovableJoint, type Part, type PartId, type Project, type Transform, type Vec3 } from '../core/types';
import { moveHardware } from '../store/commands/hardwareCommands';
import { useEditorStore } from '../store/useEditorStore';
import { useMotionStore } from '../store/useMotionStore';
import { useWorkingProject } from '../store/useSimulationStore';

const rad = (degrees: number) => degrees * Math.PI / 180;
const steel = new MeshStandardMaterial({ color: '#9aa3ab', metalness: 0.82, roughness: 0.26 });
const zinc = new MeshStandardMaterial({ color: '#b9c0c4', metalness: 0.7, roughness: 0.35 });
const steelDark = new MeshStandardMaterial({ color: '#3d464d', metalness: 0.7, roughness: 0.38 });
const chrome = new MeshStandardMaterial({ color: '#e4e9ec', metalness: 1, roughness: 0.08 });
const nylon = new MeshStandardMaterial({ color: '#2a2f33', metalness: 0.05, roughness: 0.6 });
const selectedMetal = new MeshStandardMaterial({ color: '#d59b45', metalness: 0.72, roughness: 0.25 });
const limitMetal = new MeshStandardMaterial({ color: '#c8553d', metalness: 0.6, roughness: 0.3 });

/** 行優先 Mat3 + 平行移動 から three の Matrix4 */
function toMatrix4(rigid: Rigid): Matrix4 {
  const r = rigid.rotation;
  const t = rigid.translation;
  return new Matrix4().set(r[0], r[1], r[2], t[0], r[3], r[4], r[5], t[1], r[6], r[7], r[8], t[2], 0, 0, 0, 1);
}

const frameRigid = (position: Vec3, rotation: Vec3): Rigid => ({ rotation: rotationMatrix(rotation), translation: position });

/** base ローカルの joint 変位を、金物ローカルで見た変換にする: inverse(H) * J * H */
const jointInFrame = (joint: Rigid, frame: Rigid): Matrix4 => toMatrix4(composeRigid(composeRigid(invertRigid(frame), joint), frame));

export function HardwareLayer() {
  const project = useWorkingProject();
  const poses = useMotionStore((state) => state.poses);
  return <HardwareEntries project={project} poses={poses} />;
}

/**
 * 金物を描く。取り付けのプレビューでは、まだ保存していない計画上のプロジェクトを渡し、
 * 描く金物を only で絞る（ghost のときは選択やギズモを出さない）。
 */
export function HardwareEntries({ project, poses, only, ghost = false }: {
  project: Project; poses: Map<PartId, Transform>; only?: string; ghost?: boolean;
}) {
  const entries = useMemo(() => project.hardware.filter((hardware) => !only || hardware.id === only).flatMap((hardware) => {
    const ids = hardwarePartIds(project, hardware);
    const base = ids ? project.parts.find((item) => item.id === ids.base) : undefined;
    const moving = ids ? project.parts.find((item) => item.id === ids.moving) : undefined;
    if (!base || !moving) return [];
    const joint = project.joints.find((item) => item.id === hardware.jointId) ?? null;
    const mount = project.gasSprings.find((item) => item.hardwareId === hardware.id);
    const lock = hardware.latch && joint && isMovableJoint(joint) ? latchValue(project, joint, hardware.latch.at) : 0;
    const jointBase = joint ? project.parts.find((item) => item.id === joint.basePartId) : undefined;
    // 可動の固定側と金物の固定側が違う（左右の柱にリニアガイドなど）とき、座標を合わせる変換
    const toJointBase = jointBase && jointBase.id !== base.id ? restOffset(jointBase, base) : IDENTITY_RIGID;
    return [{ hardware, joint, base, moving, mount, lock, toJointBase, pose: poses.get(base.id) ?? base.transform }];
  }), [project, poses, only]);
  return <>{entries.map((entry) => <HardwareItem key={entry.hardware.id} {...entry} ghost={ghost} />)}</>;
}

interface ItemProps {
  hardware: Hardware;
  /** 固定金具は joint を作らないことがある */
  joint: Joint | null;
  base: Part;
  moving: Part;
  mount: GasSpringMount | undefined;
  /** ドアロックが掛かる可動量 */
  lock: number;
  toJointBase: Rigid;
  pose: Transform;
  ghost?: boolean;
}

function HardwareItem({ hardware, joint, base, moving, mount, lock, toJointBase, pose, ghost = false }: ItemProps) {
  const [object, setObject] = useState<Object3D | null>(null);
  const mode = useEditorStore((state) => state.mode);
  const workspace = useEditorStore((state) => state.workspace);
  const createCategory = useEditorStore((state) => state.createCategory);
  const selected = useEditorStore((state) => state.selectedHardwareId === hardware.id);
  const selectHardware = useEditorStore((state) => state.selectHardware);
  const snap = useEditorStore((state) => state.snap.grid);
  const placing = useEditorStore((state) => state.placement.step !== null);
  const select = (event: ThreeEvent<MouseEvent>): void => {
    // 取り付け中は、金物の後ろの部材の面をクリックできるようにする
    if (ghost || placing) return;
    event.stopPropagation();
    selectHardware(hardware.id);
  };
  const editable = !ghost && !placing && selected && workspace === 'edit' && mode === 'create' && createCategory === 'hardware';

  let body: ReactNode = null;
  if (hardware.preset.kind === 'gasSpring') {
    if (mount && joint && isMovableJoint(joint)) body = <GasSpringAssembly mount={mount} joint={joint} base={base} moving={moving} quantity={hardware.quantity} selected={selected} />;
  } else {
    body = <MotionHardware hardware={hardware} joint={joint} base={base} moving={moving} lock={lock} toJointBase={toJointBase} selected={selected} setObject={setObject} />;
  }

  return <group position={[...pose.position]} rotation={pose.rotation.map(rad) as [number, number, number]} onClick={select}>
    {body}
    {editable && object && hardware.preset.kind !== 'gasSpring' ? (
      <TransformControls
        object={object}
        mode="translate"
        space="local"
        size={0.6}
        translationSnap={snap > 0 ? snap : null}
        onMouseUp={() => moveHardware(hardware.id, [object.position.x, object.position.y, object.position.z])}
      />
    ) : null}
  </group>;
}

// ------------------------------------------------------------
// 丁番・レール: 固定側の部品と、joint に合わせて動く部品に分けて描く
// ------------------------------------------------------------

function MotionHardware({ hardware, joint, base, moving, lock, toJointBase, selected, setObject }: {
  hardware: Hardware; joint: Joint | null; base: Part; moving: Part; lock: number; toJointBase: Rigid; selected: boolean; setObject: (object: Object3D | null) => void;
}) {
  const frame = frameRigid(hardware.position, hardware.rotation);
  const inverse = invertRigid(frame);
  const instances = hardwareInstances(hardware, base, moving).map((instance) => {
    const local = composeRigid(inverse, frameRigid(instance.position, instance.rotation));
    return { local, instanceFrame: frameRigid(instance.position, instance.rotation) };
  });
  const value = joint && isMovableJoint(joint) ? joint.value : 0;
  const motion = (amount: number): Rigid => (joint
    ? composeRigid(composeRigid(invertRigid(toJointBase), jointLocalRigid(withValue(joint, amount))), toJointBase)
    : IDENTITY_RIGID);

  return <group ref={setObject} position={[...hardware.position]} rotation={hardware.rotation.map(rad) as [number, number, number]}>
    {instances.map(({ local, instanceFrame }, index) => (
      <group key={index} matrixAutoUpdate={false} matrix={toMatrix4(local)}>
        {hardware.preset.kind === 'slideRail' ? (
          <SlideRailModel
            length={hardware.preset.railLength ?? hardware.preset.defaultRange?.max ?? 350}
            middle={jointInFrame(motion(value / 2), instanceFrame)}
            inner={jointInFrame(motion(value), instanceFrame)}
            selected={selected}
            undermount={hardware.preset.presetId.includes('undermount')}
          />
        ) : hardware.preset.kind === 'linearGuide' ? (
          <LinearGuideModel
            length={hardware.preset.railLength ?? 500}
            block={hardware.preset.blockLength ?? 60}
            offset={hardware.travelOffset ?? 0}
            carriage={jointInFrame(motion(value), instanceFrame)}
            selected={selected}
          />
        ) : hardware.preset.kind === 'latch' ? (
          <LatchModel
            // ストライカーは可動量 = ロック位置のとき原点に来る
            striker={jointInFrame(composeRigid(motion(value), invertRigid(motion(lock))), instanceFrame)}
            engaged={hardware.latch?.engaged === true}
            selected={selected}
          />
        ) : hardware.preset.kind === 'bracket' ? (
          <BracketModel leg={hardware.preset.bracketLeg ?? 40} selected={selected} />
        ) : (
          <HingeModel
            concealed={hardware.preset.presetId.includes('concealed')}
            door={jointInFrame(motion(value), instanceFrame)}
            plateX={plateOffset(base, instanceFrame)}
            selected={selected}
          />
        )}
      </group>
    ))}
  </group>;
}

const withValue = (joint: Joint, value: number): Joint => joint.kind === 'fixed' ? joint : { ...joint, value };

/**
 * スライド丁番の座金が付く、側板の内側の面までの距離（金物ローカル X）。
 * 扉の裏 37mm の位置で、側板の「扉の方を向いた面」と交わる X を求める。
 */
function plateOffset(base: Part, frame: Rigid): number {
  const h: Vec3 = [base.size.x / 2, base.size.y / 2, base.size.z / 2];
  const probe = applyRigid(frame, [20, 0, -37]);
  const xAxis = applyMat3(frame.rotation, [1, 0, 0]);
  let best = 0;
  let bestScore = -Infinity;
  for (const axis of [0, 1, 2] as const) {
    const normalDot = xAxis[axis]!;
    if (Math.abs(normalDot) < 0.3) continue;
    // X が増える向きに面の外へ出る側の面
    const sign = normalDot > 0 ? 1 : -1;
    const t = (sign * h[axis]! - probe[axis]!) / normalDot;
    const score = Math.abs(normalDot);
    if (score > bestScore) { bestScore = score; best = 20 + t; }
  }
  return Math.max(Math.min(best, 30), -40);
}

function HingeModel({ concealed, door, plateX, selected }: { concealed: boolean; door: Matrix4; plateX: number; selected: boolean }) {
  const main = selected ? selectedMetal : steel;
  if (concealed) {
    // 座金と腕は側板に固定。カップは扉と一緒に回る
    const armStart: Vec3 = [plateX, 0, -37];
    const armEnd: Vec3 = [16, 0, -6];
    const armMid = scale(add(armStart, armEnd), 0.5);
    const armDir = sub(armEnd, armStart);
    const armLength = length(armDir);
    const armAngle = Math.atan2(armDir[0], armDir[2]);
    return (
      <group>
        <mesh position={[plateX - 2, 0, -37]} castShadow material={zinc}><boxGeometry args={[4, 44, 18]} /></mesh>
        <mesh position={[armMid[0], 0, armMid[2]]} rotation={[0, armAngle, 0]} castShadow material={main}>
          <boxGeometry args={[6, 16, armLength]} />
        </mesh>
        <mesh position={[armMid[0] - 3, 0, armMid[2]]} rotation={[0, armAngle, 0]} material={nylon}>
          <boxGeometry args={[2, 12, armLength * 0.6]} />
        </mesh>
        <group matrixAutoUpdate={false} matrix={door}>
          <mesh position={[22.5, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]} castShadow material={main}>
            <cylinderGeometry args={[19, 19, 1.2, 28]} />
          </mesh>
          <mesh position={[22.5, 0, 5]} rotation={[Math.PI / 2, 0, 0]} material={steelDark}>
            <cylinderGeometry args={[17.4, 17.4, 11, 28]} />
          </mesh>
          <mesh position={[12, 0, -4]} rotation={[0, 0.5, 0]} castShadow material={main}><boxGeometry args={[20, 10, 3]} /></mesh>
        </group>
      </group>
    );
  }
  // 平丁番: 固定側の羽根とナックル、扉側の羽根
  return (
    <group>
      <mesh position={[-15, 0, -0.75]} castShadow material={main}><boxGeometry args={[28, 64, 1.5]} /></mesh>
      {[-24, 0, 24].map((y) => (
        <mesh key={y} position={[0, y, -2]} castShadow material={steelDark}><cylinderGeometry args={[3, 3, 12.5, 16]} /></mesh>
      ))}
      <mesh position={[0, 0, -2]} material={chrome}><cylinderGeometry args={[1.4, 1.4, 66, 10]} /></mesh>
      <group matrixAutoUpdate={false} matrix={door}>
        <mesh position={[15, 0, -0.75]} castShadow material={main}><boxGeometry args={[28, 64, 1.5]} /></mesh>
        {[-12, 12].map((y) => (
          <mesh key={y} position={[0, y, -2]} castShadow material={steelDark}><cylinderGeometry args={[3, 3, 11.5, 16]} /></mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * 3 段のボールベアリングレール。外レールは固定側、中レールは引き出し量の半分、
 * 内レールは引き出しと一緒に動く（フルスライドの構造）。
 */
export function SlideRailModel({ length: railLength, middle, inner, selected, undermount }: {
  length: number; middle: Matrix4; inner: Matrix4; selected: boolean; undermount: boolean;
}) {
  const outer = selected ? selectedMetal : zinc;
  const height = undermount ? 22 : 35;
  const balls = [-0.4, -0.2, 0, 0.2, 0.4].map((ratio) => ratio * railLength * 0.9);
  return (
    <group>
      <mesh position={[0, 0, 0.6]} castShadow receiveShadow material={outer}><boxGeometry args={[railLength, height, 1.2]} /></mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * (height / 2 - 0.6), 6]} castShadow material={outer}><boxGeometry args={[railLength, 1.2, 11]} /></mesh>
      ))}
      <mesh position={[-railLength / 2 + 4, 0, 5]} material={nylon}><boxGeometry args={[8, height - 4, 8]} /></mesh>
      <group matrixAutoUpdate={false} matrix={middle}>
        <mesh position={[0, 0, 4]} castShadow material={steel}><boxGeometry args={[railLength * 0.98, height - 7, 1.2]} /></mesh>
        {[1, -1].flatMap((s) => balls.map((x) => (
          <mesh key={`${s}-${x}`} position={[x, s * (height / 2 - 3.2), 6]} material={chrome}><sphereGeometry args={[2, 8, 6]} /></mesh>
        )))}
      </group>
      <group matrixAutoUpdate={false} matrix={inner}>
        <mesh position={[0, 0, 10.5]} castShadow material={selected ? selectedMetal : steel}>
          <boxGeometry args={[railLength * 0.96, height - 14, 1.2]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, s * (height / 2 - 7.6), 8.5]} material={steel}><boxGeometry args={[railLength * 0.96, 1, 4]} /></mesh>
        ))}
        <mesh position={[railLength * 0.46, 0, 11]} material={nylon}><boxGeometry args={[10, height - 16, 3]} /></mesh>
      </group>
    </group>
  );
}

// ------------------------------------------------------------
// ガススプリング: 2 つの取付点の間を、ボディとロッドが伸縮する
// ------------------------------------------------------------

function GasSpringAssembly({ mount, joint, base, moving, quantity, selected }: {
  mount: GasSpringMount; joint: MovableJoint; base: Part; moving: Part; quantity: number; selected: boolean;
}) {
  const offset = restOffset(base, moving);
  const pairs = gasAnchorPairs(mount, quantity, joint, base, moving);
  return <>
    {pairs.map((pair, index) => {
      const movingNow = movingAnchorAt(joint, applyRigid(offset, pair.moving), joint.value);
      return <GasSpringModel key={index} mount={mount} fixed={pair.base} movingEnd={movingNow} selected={selected} />;
    })}
  </>;
}

const Y_AXIS = new Vector3(0, 1, 0);

function GasSpringModel({ mount, fixed, movingEnd, selected }: { mount: GasSpringMount; fixed: Vec3; movingEnd: Vec3; selected: boolean }) {
  const rodAtMoving = (mount.rodEnd ?? 'moving') === 'moving';
  const bodyEnd = rodAtMoving ? fixed : movingEnd;
  const rodEnd = rodAtMoving ? movingEnd : fixed;
  const span = sub(rodEnd, bodyEnd);
  const total = length(span);
  if (total < 1) return null;
  const direction = normalize(span);
  const quaternion = new Quaternion().setFromUnitVectors(Y_AXIS, new Vector3(...direction));

  const isDamper = mount.type === 'damper';
  const bodyRadius = mount.forceN >= 80 ? 9 : 7.5;
  const rodRadius = isDamper ? 3 : mount.forceN >= 80 ? 4 : 3;
  const eye = 12;
  // 縮みきりでもロッドが 18mm 見えるように、ボディ長さを縮みきり長さから決める
  const bodyLength = Math.max(mount.strokeMin - 2 * eye - 18, 20);
  const rodVisible = Math.max(total - bodyLength - 2 * eye, 0);
  const atLimit = total > mount.strokeMax + 0.5 || total < mount.strokeMin - 0.5;
  const bodyMaterial = atLimit ? limitMetal : selected ? selectedMetal : isDamper ? steel : steelDark;

  return (
    <group>
      <Bracket at={fixed} selected={selected} />
      <Bracket at={movingEnd} selected={selected} />
      <group position={[...bodyEnd]} quaternion={quaternion}>
        <mesh position={[0, eye / 2, 0]} castShadow material={nylon}><cylinderGeometry args={[5.5, 5.5, eye, 12]} /></mesh>
        <mesh position={[0, eye + bodyLength / 2, 0]} castShadow material={bodyMaterial}>
          <cylinderGeometry args={[bodyRadius, bodyRadius, bodyLength, 20]} />
        </mesh>
        <mesh position={[0, eye + bodyLength - 1.5, 0]} material={nylon}><cylinderGeometry args={[bodyRadius + 0.4, bodyRadius + 0.4, 3, 20]} /></mesh>
        <mesh position={[0, eye + bodyLength + rodVisible / 2, 0]} castShadow material={chrome}>
          <cylinderGeometry args={[rodRadius, rodRadius, rodVisible + 2, 14]} />
        </mesh>
        <mesh position={[0, total - eye / 2, 0]} castShadow material={nylon}><cylinderGeometry args={[5, 5, eye, 12]} /></mesh>
      </group>
    </group>
  );
}

function Bracket({ at, selected }: { at: Vec3; selected: boolean }) {
  return (
    <group position={[...at]}>
      <mesh castShadow material={selected ? selectedMetal : steel}><sphereGeometry args={[5, 14, 10]} /></mesh>
      <mesh material={steelDark}><boxGeometry args={[14, 14, 14]} /></mesh>
    </group>
  );
}

// ------------------------------------------------------------
// リニアガイド・ドアロック・固定金具
// ------------------------------------------------------------

/** レール（固定側）と、その上を走るブロック（動く側）。可動量 0 でブロックはレールの下端 */
export function LinearGuideModel({ length: railLength, block, offset, carriage, selected }: { length: number; block: number; offset: number; carriage: Matrix4; selected: boolean }) {
  const holes = Math.floor((railLength - 40) / 60) + 1;
  return (
    <group>
      <mesh position={[0, 0, 7.5]} castShadow receiveShadow material={selected ? selectedMetal : steel}><boxGeometry args={[railLength, 15, 15]} /></mesh>
      {Array.from({ length: holes }, (_, i) => (
        <mesh key={i} position={[-((holes - 1) * 60) / 2 + i * 60, 0, 15.1]} rotation={[Math.PI / 2, 0, 0]} material={nylon}>
          <cylinderGeometry args={[3.8, 3.8, 0.4, 12]} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (railLength / 2 + 1), 0, 7.5]} material={nylon}><boxGeometry args={[2, 15, 15]} /></mesh>
      ))}
      <group matrixAutoUpdate={false} matrix={carriage}>
        <group position={[-railLength / 2 + block / 2 + offset, 0, 0]}>
          <mesh position={[0, 0, 19]} castShadow material={selected ? selectedMetal : zinc}><boxGeometry args={[block, 34, 18]} /></mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * (block / 2 + 3), 0, 18]} material={nylon}><boxGeometry args={[6, 30, 14]} /></mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** 受け金具（固定側）とストライカー（動く側）。掛かっているとラッチの爪が出る */
function LatchModel({ striker, engaged, selected }: { striker: Matrix4; engaged: boolean; selected: boolean }) {
  return (
    <group>
      <mesh position={[14, 0, 0]} castShadow material={selected ? selectedMetal : steelDark}><boxGeometry args={[24, 40, 16]} /></mesh>
      <mesh position={[engaged ? 1 : 5, 0, 0]} material={engaged ? limitMetal : chrome}><boxGeometry args={[6, 10, 8]} /></mesh>
      <group matrixAutoUpdate={false} matrix={striker}>
        <mesh position={[-10, 0, 0]} castShadow material={selected ? selectedMetal : steel}><boxGeometry args={[4, 36, 14]} /></mesh>
        <mesh position={[-4, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={chrome}><cylinderGeometry args={[3, 3, 10, 12]} /></mesh>
      </group>
    </group>
  );
}

/** L 字金具。+X の脚が固定側の面、+Y の脚が取り付ける側の面に沿う */
function BracketModel({ leg, selected }: { leg: number; selected: boolean }) {
  const width = leg >= 60 ? 20 : 15;
  const material = selected ? selectedMetal : zinc;
  return (
    <group>
      <mesh position={[leg / 2, 1, 0]} castShadow material={material}><boxGeometry args={[leg, 2, width]} /></mesh>
      <mesh position={[1, leg / 2, 0]} castShadow material={material}><boxGeometry args={[2, leg, width]} /></mesh>
    </group>
  );
}

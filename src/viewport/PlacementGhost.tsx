import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { BoxGeometry, Matrix4, MeshStandardMaterial, type Group, type Mesh } from 'three';
import { faceVector } from '../core/hardware/mechanism';
import { getHardwarePreset } from '../core/hardware/presets';
import { applyMat3, matrixFromColumns, rotationMatrix, transpose } from '../core/math/matrix';
import { cross, dot, scale } from '../core/math/vec3';
import { solvePoses } from '../core/motion/kinematics';
import type { AxisDirection, HardwarePreset, Part, Transform, Vec3 } from '../core/types';
import { placementPlan } from '../store/commands/placementCommands';
import { useEditorStore, type PlacementPoint } from '../store/useEditorStore';
import { useMotionStore } from '../store/useMotionStore';
import { useProjectStore } from '../store/useProjectStore';
import { HardwareEntries, LinearGuideModel, SlideRailModel } from './HardwareLayer';

/**
 * 取り付けのプレビュー（設計書 DESIGN_V2 §10.7）。
 * 取り付けたらどうなるかを、実際の計算結果（planHardware）から透過で描く。
 * 付けられるなら青、付けられないなら赤。プレビューはクリックを邪魔しない。
 */

const okMaterial = new MeshStandardMaterial({ color: '#6fb3ff', transparent: true, opacity: 0.55, depthWrite: false });
const badMaterial = new MeshStandardMaterial({ color: '#ff6b5a', transparent: true, opacity: 0.55, depthWrite: false });
const partGhostMaterial = new MeshStandardMaterial({ color: '#6fb3ff', transparent: true, opacity: 0.18, depthWrite: false });
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** 子のメッシュをすべて透過の材質にして、レイキャストから外す */
function Ghost({ ok, material, children }: { ok: boolean; material?: MeshStandardMaterial; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.material = material ?? (ok ? okMaterial : badMaterial);
      mesh.raycast = () => undefined;
      mesh.castShadow = false;
      mesh.renderOrder = 6;
    });
  });
  return <group ref={ref}>{children}</group>;
}

export function PlacementGhost() {
  const placement = useEditorStore((s) => s.placement);
  const options = useEditorStore((s) => s.placementOptions);
  const project = useProjectStore((s) => s.project);
  const poses = useMotionStore((s) => s.poses);
  const plan = useMemo(
    () => (placement.step === 'moving' || placement.step === 'ready' ? placementPlan(project, placement, options) : null),
    [project, placement, options],
  );
  const planPoses = useMemo(() => (plan && !('error' in plan) ? solvePoses(plan.next).poses : null), [plan]);
  const preset = getHardwarePreset(options.presetId);
  if (!placement.step || !preset) return null;

  // 動く側が決まる前: 固定側の部品だけを、置いた（またはマウスの）位置に描く
  if (!plan || 'error' in plan) {
    const point = placement.step === 'base' ? placement.hover : placement.base;
    const part = point ? project.parts.find((item) => item.id === point.partId) : undefined;
    if (!point || !part) return null;
    return (
      <Ghost ok={!plan}>
        <BaseOnly part={part} pose={poses.get(part.id) ?? part.transform} point={point} preset={preset} turn={placement.turn} flip={placement.flip} />
      </Ghost>
    );
  }

  const moved = plan.next.parts.filter((part) => plan.moved.includes(part.id));
  return (
    <>
      <Ghost ok>
        <HardwareEntries project={plan.next} poses={planPoses ?? new Map()} only={plan.hardwareId} ghost />
      </Ghost>
      {moved.length > 0 ? (
        <Ghost ok material={partGhostMaterial}>
          {moved.map((part) => <PartBox key={part.id} part={part} />)}
        </Ghost>
      ) : null}
    </>
  );
}

/** 寄せたあとの部材の位置を、薄い箱で見せる */
function PartBox({ part }: { part: Part }) {
  const geometry = useMemo(() => new BoxGeometry(part.size.x, part.size.y, part.size.z), [part.size.x, part.size.y, part.size.z]);
  return (
    <mesh geometry={geometry} position={[...part.transform.position]} rotation={part.transform.rotation.map(rad) as [number, number, number]} />
  );
}

/**
 * 固定側の部品だけのプレビュー。レール・ガイドは取付面に沿った向き（リニアは上下）で、
 * そのほかは取付位置の印を描く。
 */
function BaseOnly({ part, pose, point, preset, turn, flip }: {
  part: Part; pose: Transform; point: PlacementPoint; preset: HardwarePreset; turn: boolean; flip: boolean;
}) {
  const matrix = useMemo(() => {
    const z = faceVector(point.face);
    let x = defaultDirection(part, pose, point.face, preset);
    let y = cross(z, x);
    if (turn) [x, y] = [y, scale(x, -1)];
    if (flip) [x, y] = [scale(x, -1), scale(y, -1)];
    const r = matrixFromColumns(x, y, z);
    return new Matrix4().set(r[0], r[1], r[2], point.point[0], r[3], r[4], r[5], point.point[1], r[6], r[7], r[8], point.point[2], 0, 0, 0, 1);
  }, [part, pose, point, preset, turn, flip]);
  return (
    <group position={[...pose.position]} rotation={pose.rotation.map(rad) as [number, number, number]}>
      <group matrixAutoUpdate={false} matrix={matrix}>
        {preset.kind === 'linearGuide' ? (
          <LinearGuideModel length={preset.railLength ?? 500} block={preset.blockLength ?? 60} offset={0} carriage={new Matrix4()} selected={false} />
        ) : preset.kind === 'slideRail' ? (
          <SlideRailModel length={preset.railLength ?? 350} middle={new Matrix4()} inner={new Matrix4()} selected={false} undermount={preset.presetId.includes('undermount')} />
        ) : (
          <>
            <mesh position={[0, 0, 1]}><cylinderGeometry args={[preset.kind === 'gasSpring' ? 8 : 12, preset.kind === 'gasSpring' ? 8 : 12, 2, 20]} /></mesh>
            <mesh position={[0, 0, preset.kind === 'gasSpring' ? 15 : 6]}><sphereGeometry args={[preset.kind === 'gasSpring' ? 6 : 3, 14, 10]} /></mesh>
          </>
        )}
      </group>
    </group>
  );
}

/** 面の中での既定の向き。リニアガイドは上下（上が正）、そのほかは面の長い方向 */
function defaultDirection(part: Part, pose: Transform, face: AxisDirection, preset: HardwarePreset): Vec3 {
  const k = face[1] === 'x' ? 0 : face[1] === 'y' ? 1 : 2;
  const inPlane = [0, 1, 2].filter((i) => i !== k);
  const unit = (i: number): Vec3 => (i === 0 ? [1, 0, 0] : i === 1 ? [0, 1, 0] : [0, 0, 1]);
  if (preset.kind === 'linearGuide') {
    const up = applyMat3(transpose(rotationMatrix(pose.rotation)), [0, 1, 0]);
    const best = inPlane.reduce((a, b) => (Math.abs(up[b]!) > Math.abs(up[a]!) ? b : a));
    return scale(unit(best), dot(unit(best), up) >= 0 ? 1 : -1);
  }
  const sizes = [part.size.x, part.size.y, part.size.z];
  return unit(inPlane.reduce((a, b) => (sizes[b]! > sizes[a]! ? b : a)));
}

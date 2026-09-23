import { useMemo } from 'react';
import { BufferGeometry, EllipseCurve, Float32BufferAttribute, LineBasicMaterial } from 'three';
import { degToRad } from '../core/math/angle';
import { localToWorldDir, localToWorldPoint } from '../core/math/matrix';
import { add, normalize, scale } from '../core/math/vec3';
import { isMovableJoint, type MovableJoint, type Part, type Vec3 } from '../core/types';
import { useEditorStore } from '../store/useEditorStore';
import { useMotionStore } from '../store/useMotionStore';
import { useProjectStore } from '../store/useProjectStore';

const axisMaterial = new LineBasicMaterial({ color: 0x6fb3e0, depthTest: false, transparent: true });
const arcMaterial = new LineBasicMaterial({ color: 0xe7ac68, depthTest: false, transparent: true });

/**
 * 折れ線を線分の列に変換して BufferGeometry にする。
 * R3F の `<line>` は SVG の line と名前が衝突するため、`<lineSegments>` を使う
 * （Ver.1 の SelectionOutline と同じ方針）。
 */
function polylineGeometry(points: readonly Vec3[]): BufferGeometry {
  const values: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    values.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
  return geometry;
}

/** 軸に直交する 2 本の単位ベクトル。円弧を描く平面を作る。 */
function basisFor(axis: Vec3): [Vec3, Vec3] {
  const n = normalize(axis);
  const helper: Vec3 = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize([
    helper[1] * n[2] - helper[2] * n[1],
    helper[2] * n[0] - helper[0] * n[2],
    helper[0] * n[1] - helper[1] * n[0],
  ]);
  const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return [u, v];
}

interface Visual {
  axis: BufferGeometry;
  arc: BufferGeometry | null;
}

/**
 * 可動の向きを 3D に描く。
 * ヒンジは回転軸の線と可動範囲の円弧、スライドは移動方向の線。
 * base 部材の現在の姿勢を通して描くので、本体ごと動かしても軸が付いてくる。
 */
function JointVisual({ joint, base }: { joint: MovableJoint; base: Part }) {
  const visual = useMemo<Visual>(() => {
    if (joint.kind === 'prismatic') {
      const dir = normalize(localToWorldDir(base.transform, joint.axis));
      const origin = localToWorldPoint(base.transform, [0, 0, 0]);
      const span = Math.max(joint.range.max - joint.range.min, 100);
      return { axis: polylineGeometry([origin, add(origin, scale(dir, span))]), arc: null };
    }

    const worldOrigin = localToWorldPoint(base.transform, joint.origin);
    const dir = normalize(localToWorldDir(base.transform, joint.axis));
    const half = 120;
    const axis = polylineGeometry([add(worldOrigin, scale(dir, -half)), add(worldOrigin, scale(dir, half))]);

    const [u, v] = basisFor(dir);
    const curve = new EllipseCurve(
      0, 0, 90, 90,
      degToRad(joint.range.min), degToRad(joint.range.max),
      false, 0,
    );
    const points = curve.getPoints(48).map((p) => add(worldOrigin, add(scale(u, p.x), scale(v, p.y))));
    return { axis, arc: polylineGeometry(points) };
  }, [joint, base]);

  return (
    <>
      <lineSegments geometry={visual.axis} material={axisMaterial} renderOrder={5} raycast={() => null} />
      {visual.arc ? (
        <lineSegments geometry={visual.arc} material={arcMaterial} renderOrder={5} raycast={() => null} />
      ) : null}
    </>
  );
}

export function JointGizmo() {
  const selectedJointId = useEditorStore((s) => s.selectedJointId);
  const workspace = useEditorStore((s) => s.workspace);
  const project = useProjectStore((s) => s.project);
  const poses = useMotionStore((s) => s.poses);

  if (workspace !== 'motionCheck' || !selectedJointId) return null;
  const joint = project.joints.find((j) => j.id === selectedJointId);
  if (!joint || !isMovableJoint(joint)) return null;
  const basePart = project.parts.find((p) => p.id === joint.basePartId);
  if (!basePart) return null;

  // base 自身も動いているかもしれないので、現在の姿勢で描く
  const posed: Part = { ...basePart, transform: poses.get(basePart.id) ?? basePart.transform };
  return <JointVisual joint={joint} base={posed} />;
}

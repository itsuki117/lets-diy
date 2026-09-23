import { useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei/core/TransformControls';
import { MeshStandardMaterial, type Object3D } from 'three';
import type { Hardware, Transform } from '../core/types';
import { moveHardware } from '../store/commands/hardwareCommands';
import { useEditorStore } from '../store/useEditorStore';
import { useMotionStore } from '../store/useMotionStore';
import { useProjectStore } from '../store/useProjectStore';

const rad = (degrees: number) => degrees * Math.PI / 180;
const steel = new MeshStandardMaterial({ color: '#929ba3', metalness: 0.82, roughness: 0.24 });
const steelDark = new MeshStandardMaterial({ color: '#4e5962', metalness: 0.78, roughness: 0.3 });
const chrome = new MeshStandardMaterial({ color: '#d7dde0', metalness: 0.95, roughness: 0.12 });
const rubber = new MeshStandardMaterial({ color: '#20252a', metalness: 0.05, roughness: 0.72 });
const selectedMetal = new MeshStandardMaterial({ color: '#d59b45', metalness: 0.72, roughness: 0.25 });

export function HardwareLayer() {
  const project = useProjectStore((state) => state.project);
  const poses = useMotionStore((state) => state.poses);
  const entries = useMemo(() => project.hardware.flatMap((hardware) => {
    const joint = hardware.jointId ? project.joints.find((item) => item.id === hardware.jointId) : undefined;
    const base = joint ? project.parts.find((item) => item.id === joint.basePartId) : undefined;
    if (!base) return [];
    return [{ hardware, pose: poses.get(base.id) ?? base.transform }];
  }), [project, poses]);
  return <>{entries.map((entry) => <HardwareItem key={entry.hardware.id} {...entry} />)}</>;
}

function HardwareItem({ hardware, pose }: { hardware: Hardware; pose: Transform }) {
  const [object, setObject] = useState<Object3D | null>(null);
  const mode = useEditorStore((state) => state.mode);
  const workspace = useEditorStore((state) => state.workspace);
  const createCategory = useEditorStore((state) => state.createCategory);
  const selected = useEditorStore((state) => state.selectedHardwareId === hardware.id);
  const selectHardware = useEditorStore((state) => state.selectHardware);
  const snap = useEditorStore((state) => state.snap.grid);
  const select = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    selectHardware(hardware.id);
  };

  return <group position={[...pose.position]} rotation={pose.rotation.map(rad) as [number, number, number]}>
    <group
      ref={setObject}
      position={[...hardware.position]}
      rotation={hardware.rotation.map(rad) as [number, number, number]}
      onClick={select}
    >
      <HardwareModel hardware={hardware} selected={selected} />
    </group>
    {selected && workspace === 'edit' && mode === 'create' && createCategory === 'hardware' && object ? (
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

/** 種類が一目で分かる、軽量な金物モデル。外部アセットなしで寸法感も保つ。 */
export function HardwareModel({ hardware, selected }: { hardware: Hardware; selected: boolean }) {
  if (hardware.preset.kind === 'slideRail') {
    return <SlideRailModel length={hardware.preset.defaultRange?.max ?? 350} selected={selected} />;
  }
  if (hardware.preset.kind === 'gasSpring') {
    return <GasSpringModel length={hardware.preset.gasSpring?.strokeMax ?? 400} selected={selected} />;
  }
  return <HingeModel concealed={hardware.preset.presetId.includes('concealed')} selected={selected} />;
}

function SlideRailModel({ length, selected }: { length: number; selected: boolean }) {
  const main = selected ? selectedMetal : steel;
  const holeXs = [-0.36, -0.12, 0.14, 0.37].map((ratio) => ratio * length);
  const bearingXs = [-0.25, -0.08, 0.09, 0.26].map((ratio) => ratio * length);
  return (
    <group>
      <mesh castShadow receiveShadow material={main}><boxGeometry args={[length, 18, 3]} /></mesh>
      <mesh position={[length * 0.055, 0, 4]} castShadow material={selected ? selectedMetal : steelDark}>
        <boxGeometry args={[length * 0.88, 12, 3]} />
      </mesh>
      <mesh position={[length * 0.16, 0, 7]} castShadow material={main}>
        <boxGeometry args={[length * 0.62, 7, 2.5]} />
      </mesh>
      {holeXs.map((x) => (
        <group key={x} position={[x, 0, 1.8]}>
          <mesh material={rubber}><cylinderGeometry args={[3.2, 3.2, 1.2, 14]} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={steelDark}><torusGeometry args={[4.2, 0.75, 8, 16]} /></mesh>
        </group>
      ))}
      {bearingXs.map((x) => (
        <mesh key={x} position={[x, 6.2, 4]} castShadow material={chrome}>
          <sphereGeometry args={[2.1, 10, 8]} />
        </mesh>
      ))}
      <mesh position={[-length / 2 + 5, 0, 5]} material={rubber}><boxGeometry args={[7, 15, 8]} /></mesh>
    </group>
  );
}

function GasSpringModel({ length, selected }: { length: number; selected: boolean }) {
  const total = Math.max(220, Math.min(length, 460));
  const bodyLength = total * 0.54;
  const rodLength = total - bodyLength + 18;
  const bodyCenter = -total / 2 + bodyLength / 2 + 15;
  const rodCenter = bodyCenter + bodyLength / 2 + rodLength / 2 - 16;
  const main = selected ? selectedMetal : steelDark;
  return (
    <group>
      <mesh position={[bodyCenter, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={main}>
        <cylinderGeometry args={[10, 10, bodyLength, 20]} />
      </mesh>
      <mesh position={[bodyCenter - bodyLength / 2, 0, 0]} castShadow material={main}>
        <sphereGeometry args={[10, 16, 12]} />
      </mesh>
      <mesh position={[rodCenter, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={chrome}>
        <cylinderGeometry args={[4, 4, rodLength, 14]} />
      </mesh>
      <mesh position={[bodyCenter + bodyLength / 2 - 3, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={rubber}>
        <cylinderGeometry args={[11.5, 11.5, 8, 18]} />
      </mesh>
      <EndEye x={-total / 2} selected={selected} />
      <EndEye x={total / 2} selected={selected} />
    </group>
  );
}

function EndEye({ x, selected }: { x: number; selected: boolean }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh castShadow material={selected ? selectedMetal : steel}><sphereGeometry args={[10, 16, 12]} /></mesh>
      <mesh material={rubber}><torusGeometry args={[4.2, 1.8, 10, 20]} /></mesh>
    </group>
  );
}

function HingeModel({ concealed, selected }: { concealed: boolean; selected: boolean }) {
  const main = selected ? selectedMetal : steel;
  if (concealed) {
    return (
      <group>
        <mesh position={[-18, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow material={main}><cylinderGeometry args={[18, 18, 11, 24]} /></mesh>
        <mesh position={[12, 0, 0]} castShadow material={main}><boxGeometry args={[42, 12, 5]} /></mesh>
        <mesh position={[36, 0, 0]} castShadow material={steelDark}><boxGeometry args={[24, 34, 4]} /></mesh>
        <mesh position={[36, 10, 3]} rotation={[Math.PI / 2, 0, 0]} material={rubber}><cylinderGeometry args={[2.5, 2.5, 2, 12]} /></mesh>
        <mesh position={[36, -10, 3]} rotation={[Math.PI / 2, 0, 0]} material={rubber}><cylinderGeometry args={[2.5, 2.5, 2, 12]} /></mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[-17, 0, 0]} castShadow material={main}><boxGeometry args={[30, 64, 3]} /></mesh>
      <mesh position={[17, 0, 0]} castShadow material={main}><boxGeometry args={[30, 64, 3]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow material={steelDark}><cylinderGeometry args={[4, 4, 68, 16]} /></mesh>
      {[-22, 22].flatMap((y) => [-17, 17].map((x) => (
        <mesh key={`${x}-${y}`} position={[x, y, 2]} rotation={[Math.PI / 2, 0, 0]} material={rubber}>
          <cylinderGeometry args={[2.5, 2.5, 1, 12]} />
        </mesh>
      )))}
    </group>
  );
}

import { useMemo, useState } from 'react';
import type { Object3D } from 'three';
import { TransformControls } from '@react-three/drei/core/TransformControls';
import type { Hardware, Transform } from '../core/types';
import { moveHardware } from '../store/commands/hardwareCommands';
import { useEditorStore } from '../store/useEditorStore';
import { useMotionStore } from '../store/useMotionStore';
import { useProjectStore } from '../store/useProjectStore';

const rad = (degrees: number) => degrees * Math.PI / 180;

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
  const selected = useEditorStore((state) => state.selectedHardwareId === hardware.id);
  const selectHardware = useEditorStore((state) => state.selectHardware);
  const snap = useEditorStore((state) => state.snap.grid);
  return <group position={[...pose.position]} rotation={pose.rotation.map(rad) as [number, number, number]}>
    <group ref={setObject} position={[...hardware.position]} rotation={hardware.rotation.map(rad) as [number, number, number]}>
      <mesh castShadow onClick={(event) => { event.stopPropagation(); selectHardware(hardware.id); }}>
        {hardware.preset.kind === 'hinge' ? <boxGeometry args={[30, 64, 4]} /> : hardware.preset.kind === 'slideRail' ? <boxGeometry args={[hardware.preset.defaultRange?.max ?? 350, 12, 8]} /> : <cylinderGeometry args={[7, 7, 150, 16]} />}
        <meshStandardMaterial color={selected ? '#d59b45' : '#7f8a92'} metalness={0.65} roughness={0.32} />
      </mesh>
    </group>
    {selected && mode === 'hardware' && object ? <TransformControls object={object} mode="translate" space="local" size={0.6} translationSnap={snap > 0 ? snap : null} onMouseUp={() => moveHardware(hardware.id, [object.position.x, object.position.y, object.position.z])} /> : null}
  </group>;
}

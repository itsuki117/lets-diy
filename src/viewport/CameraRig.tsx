import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import { useThree } from '@react-three/fiber';
import { MOUSE, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { partsAabb } from '../core/part/partBounds';
import { useProjectStore } from '../store/useProjectStore';
import { subscribeFocus } from '../store/cameraCommands';
import type { ViewPreset } from './ViewCube';

const directions: Record<ViewPreset, [number, number, number]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  top: [0, 1, 0.000001],
  bottom: [0, -1, 0.000001],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  iso: [0.65, 0.5, 1],
};

export function CameraRig({ view }: { view: { preset: ViewPreset; revision: number } }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const target = ref.current?.target ?? new Vector3();
    const distance = Math.max(camera.position.distanceTo(target), 500);
    camera.position.copy(new Vector3(...directions[view.preset]).normalize().multiplyScalar(distance).add(target));
    camera.lookAt(target);
    ref.current?.update();
    invalidate();
  }, [view, camera, invalidate]);

  // 選択部材にカメラを寄せる（F キー / ボタン）
  useEffect(
    () =>
      subscribeFocus((partIds) => {
        const parts = useProjectStore
          .getState()
          .project.parts.filter((p) => (partIds.length === 0 ? true : partIds.includes(p.id)));
        const box = partsAabb(parts);
        if (!box) return;
        const center = new Vector3(
          (box.min[0] + box.max[0]) / 2,
          (box.min[1] + box.max[1]) / 2,
          (box.min[2] + box.max[2]) / 2,
        );
        const span = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
        const distance = Math.max(span * 1.8, 300);
        const offset = camera.position.clone().sub(ref.current?.target ?? new Vector3());
        if (offset.lengthSq() < 1) offset.set(0.65, 0.5, 1);
        camera.position.copy(center.clone().add(offset.normalize().multiplyScalar(distance)));
        ref.current?.target.copy(center);
        camera.lookAt(center);
        ref.current?.update();
        invalidate();
      }),
    [camera, invalidate],
  );

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping={false}
      minDistance={10}
      maxDistance={40000}
      mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN }}
    />
  );
}

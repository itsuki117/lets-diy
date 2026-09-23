import { GizmoHelper } from '@react-three/drei/core/GizmoHelper';
import { GizmoViewport } from '@react-three/drei/core/GizmoViewport';
import { Lighting } from './Lighting';
import { GridFloor } from './GridFloor';
import { CameraRig } from './CameraRig';
import { PartsLayer } from './PartsLayer';
import { TransformGizmo } from './TransformGizmo';
import { OperationPreview } from './OperationPreview';
import { OperationGizmo } from './OperationGizmo';
import { JointGizmo } from './JointGizmo';
import { FacePickOverlay } from './FacePickOverlay';
import { useInvalidateOnStore } from './hooks/useInvalidateOnStore';
import type { ViewPreset } from './ViewCube';

export function SceneRoot({ view }: { view: { preset: ViewPreset; revision: number } }) {
  useInvalidateOnStore();
  return (
    <>
      <Lighting />
      <GridFloor />
      <axesHelper args={[200]} />
      <PartsLayer />
      <TransformGizmo />
      <OperationPreview />
      <OperationGizmo />
      <JointGizmo />
      <FacePickOverlay />
      <CameraRig view={view} />
      <GizmoHelper alignment="bottom-left" margin={[65, 70]}>
        <GizmoViewport axisColors={['#e67976', '#9cbc82', '#81a9d7']} labelColor="#15191d" />
      </GizmoHelper>
    </>
  );
}

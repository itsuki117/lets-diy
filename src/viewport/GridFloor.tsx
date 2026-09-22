import { Grid } from '@react-three/drei/core/Grid';
import { useEditorStore } from '../store/useEditorStore';

export function GridFloor() {
  const showGrid = useEditorStore((s) => s.viewOptions.grid);
  const shadows = useEditorStore((s) => s.viewOptions.shadows);
  return (
    <>
      {showGrid ? (
        <Grid
          infiniteGrid
          cellSize={100}
          sectionSize={1000}
          cellColor="#363f48"
          sectionColor="#697780"
          cellThickness={0.5}
          sectionThickness={1}
          fadeDistance={8000}
          fadeStrength={2}
          position={[0, -0.2, 0]}
        />
      ) : null}
      {shadows ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[50000, 50000]} />
          <shadowMaterial transparent opacity={0.2} />
        </mesh>
      ) : null}
    </>
  );
}

import { useEditorStore } from '../store/useEditorStore';

export function Lighting() {
  const shadows = useEditorStore((s) => s.viewOptions.shadows);
  return (
    <>
      <hemisphereLight args={[0xffffff, 0x666666, 1.2]} />
      <directionalLight
        position={[1500, 2500, 1000]}
        intensity={1.6}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-2000}
        shadow-camera-right={2000}
        shadow-camera-top={2000}
        shadow-camera-bottom={-2000}
        shadow-camera-near={1}
        shadow-camera-far={8000}
        shadow-bias={-0.0001}
      />
      <ambientLight intensity={0.35} />
    </>
  );
}

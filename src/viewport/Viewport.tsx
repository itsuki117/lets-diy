import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PCFShadowMap } from 'three';
import { MonitorX } from 'lucide-react';
import { HintBar } from '../ui/common/HintBar';
import { useEditorStore } from '../store/useEditorStore';
import { SceneRoot } from './SceneRoot';
import { ViewCube, type ViewPreset } from './ViewCube';

function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function Viewport() {
  const [supported] = useState(supportsWebGL2);
  const [view, setView] = useState<{ preset: ViewPreset; revision: number }>({ preset: 'iso', revision: 0 });
  const shadows = useEditorStore((s) => s.viewOptions.shadows);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  if (!supported) {
    return (
      <div className="fallback">
        <MonitorX size={32} aria-hidden />
        <h3>この環境では3D表示を利用できません</h3>
        <p>
          WebGL2に対応したブラウザで開いてください。
          <br />
          部材の数値編集と保存は利用できます。
        </p>
      </div>
    );
  }

  return (
    <>
      <Canvas
        frameloop="demand"
        shadows={shadows ? { type: PCFShadowMap } : false}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        camera={{ fov: 45, near: 1, far: 100000, position: [800, 600, 1200] }}
        onPointerMissed={() => clearSelection()}
      >
        <color attach="background" args={['#181c21']} />
        <SceneRoot view={view} />
      </Canvas>
      <div className="workspace-label">
        PERSPECTIVE <span> / </span> mm
      </div>
      <HintBar />
      <ViewCube onChange={(preset) => setView({ preset, revision: view.revision + 1 })} />
      <div className="camera-help">
        ドラッグ 回転 <span>/</span> 右ドラッグ 移動 <span>/</span> スクロール 拡大
      </div>
    </>
  );
}

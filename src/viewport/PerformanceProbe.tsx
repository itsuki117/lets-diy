import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { getCameraTarget } from '../store/cameraCommands';
import { geometryCache } from '../geometry/GeometryCache';
import { useProjectStore } from '../store/useProjectStore';

/** Explicit opt-in development instrumentation. Never included in a production scene. */
export function PerformanceProbe({ output, run }: { output: RefObject<HTMLOutputElement | null>; run: number }) {
  const frames = useRef(0);
  const sample = useRef({ run: 0, start: 0, previous: 0, intervals: [] as number[], angle: 0, radius: 1, result: '' });
  useFrame(({ gl, camera, invalidate }) => {
    frames.current += 1;
    const now = performance.now();
    const current = sample.current;
    const target = getCameraTarget();
    if (run > 0 && current.run !== run) {
      Object.assign(current, { run, start: now, previous: now, intervals: [], result: '',
        angle: Math.atan2(camera.position.x - target[0], camera.position.z - target[2]),
        radius: Math.hypot(camera.position.x - target[0], camera.position.z - target[2]),
      });
    }
    if (run > 0 && !current.result) {
      if (now > current.previous) current.intervals.push(now - current.previous);
      current.previous = now;
      if (now - current.start < 5000) {
        const angle = current.angle + (now - current.start) / 5000 * Math.PI / 2;
        camera.position.x = target[0] + Math.sin(angle) * current.radius;
        camera.position.z = target[2] + Math.cos(angle) * current.radius;
        camera.lookAt(...target);
        // Only this opt-in five-second benchmark requests continuous frames.
        invalidate();
      } else {
        const sorted = [...current.intervals].sort((a, b) => a - b);
        current.result = `fps=${(current.intervals.length * 1000 / (now - current.start)).toFixed(1)} p95FrameMs=${sorted[Math.floor(sorted.length * .95)]?.toFixed(1)}`;
      }
    }
    if (output.current) {
      const parts = useProjectStore.getState().project.parts;
      const statuses = parts.map((part) => geometryCache.status(part.id));
      output.current.textContent = `frames=${frames.current} geometries=${gl.info.memory.geometries} calls=${gl.info.render.calls} triangles=${gl.info.render.triangles} pending=${statuses.filter((s) => s.building).length} failed=${statuses.reduce((n, s) => n + s.failedOperationIds.length, 0)} ${current.result}`;
    }
  });
  return null;
}

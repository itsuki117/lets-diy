import { performance } from 'node:perf_hooks';
import { createProject } from '../src/core/project/createProject';
import { createPart } from '../src/core/part/createPart';
import { hingeLayout } from '../src/core/hardware/mechanism';
import { solvePoses } from '../src/core/motion/kinematics';
import { scanJointMotion } from '../src/core/motion/motionScan';
import type { Joint, Project } from '../src/core/types';

const parts = Array.from({ length: 50 }, (_, index) => createPart({
  name: `部材 ${index + 1}`,
  size: { x: 300, y: 600, z: 18 },
  position: [(index % 10) * 400, Math.floor(index / 10) * 700, 0],
}));
const joints: Joint[] = Array.from({ length: 10 }, (_, index) => {
  const base = parts[index * 2]!;
  const moving = parts[index * 2 + 1]!;
  const layout = hingeLayout(base, moving);
  return {
    id: `jnt-${index}`, name: `扉 ${index + 1}`, enabled: true, kind: 'revolute',
    basePartId: base.id, movingPartId: moving.id, origin: layout.origin, axis: layout.axis, value: 0, range: { min: 0, max: 110 },
  };
});
const project: Project = { ...createProject('Ver.2 performance'), parts, joints };

for (let index = 0; index < 50; index += 1) solvePoses(project);
const samples = Array.from({ length: 1000 }, () => {
  const start = performance.now();
  solvePoses(project);
  return performance.now() - start;
}).sort((a, b) => a - b);

const scanStart = performance.now();
scanJointMotion(project, joints[0]!.id, 36);
const scanMs = performance.now() - scanStart;
const median = samples[Math.floor(samples.length / 2)]!;
const p95 = samples[Math.floor(samples.length * 0.95)]!;

console.log(JSON.stringify({ parts: parts.length, joints: joints.length, solveMedianMs: median, solveP95Ms: p95, scan36Ms: scanMs }, null, 2));

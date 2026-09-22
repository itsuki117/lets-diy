import { cpus, platform, arch } from 'node:os';
import { buildPartGeometry } from '../src/geometry/geometryBuilder';
import { sampleProject } from './genSample';

const part = sampleProject(1, 10).parts[0]!;
for (let i = 0; i < 3; i++) (await buildPartGeometry(part)).geometry.dispose();
const timings: number[] = [];
for (let i = 0; i < 20; i++) {
  const result = await buildPartGeometry(part);
  if (result.failedOperationIds.length) throw new Error('CSG failed');
  timings.push(result.durationMs);
  result.geometry.dispose();
}
timings.sort((a, b) => a - b);
const start = performance.now();
for (const entry of sampleProject().parts) {
  const result = await buildPartGeometry(entry);
  if (result.failedOperationIds.length) throw new Error('Sample CSG failed');
  result.geometry.dispose();
}
console.log(JSON.stringify({
  node: process.version, platform: `${platform()} ${arch()}`, cpu: cpus()[0]?.model,
  samples: timings.length, operations: 10,
  medianMs: timings[10], p95Ms: timings[18], maxMs: timings[19],
  all50Parts200OperationsMs: performance.now() - start,
}, null, 2));

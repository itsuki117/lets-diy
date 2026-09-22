import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createPart } from '../src/core/part/createPart';
import { createProject } from '../src/core/project/createProject';
import { toDocument } from '../src/core/project/serialize';
import type { Operation, Project } from '../src/core/types';

export function sampleProject(count = 50, operationsPerPart = 4): Project {
  const project = createProject();
  project.name = `性能検証 ${count}部材 ${count * operationsPerPart}加工`;
  project.parts = Array.from({ length: count }, (_, i) => createPart({
    name: `検証板 ${i + 1}`, size: { x: 600, y: 300, z: 18 },
    position: [(i % 10) * 650, 150, Math.floor(i / 10) * 400],
  }));
  for (const part of project.parts) {
    part.operations = Array.from({ length: operationsPerPart }, (_, i): Operation => ({
      id: `op-${part.id}-${i}`, type: 'roundHole', enabled: true,
      diameter: 8, depth: 9, through: true, direction: '-z',
      position: [-250 + (i % 5) * 100, -80 + Math.floor(i / 5) * 160, 0],
    }));
  }
  return project;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mkdir('samples', { recursive: true });
  await writeFile('samples/performance-50-200.json', JSON.stringify(toDocument(sampleProject()), null, 2));
  console.log('Created samples/performance-50-200.json');
}

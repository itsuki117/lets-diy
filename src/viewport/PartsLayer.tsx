import { useProjectStore } from '../store/useProjectStore';
import { PartMesh } from './PartMesh';

export function PartsLayer() {
  const parts = useProjectStore((s) => s.project.parts);
  return (
    <>
      {parts.map((part) => (
        <PartMesh key={part.id} part={part} />
      ))}
    </>
  );
}

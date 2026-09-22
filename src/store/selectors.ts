import type { Part, PartId } from '../core/types';
import { useEditorStore } from './useEditorStore';
import { useProjectStore } from './useProjectStore';

export const useParts = (): Part[] => useProjectStore((s) => s.project.parts);

export const usePartById = (id: PartId | null | undefined): Part | undefined =>
  useProjectStore((s) => (id ? s.project.parts.find((p) => p.id === id) : undefined));

export function useSelectedParts(): Part[] {
  const parts = useProjectStore((s) => s.project.parts);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  return parts.filter((p) => selectedIds.includes(p.id));
}

export function useSelectedPart(): Part | undefined {
  const parts = useProjectStore((s) => s.project.parts);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  return selectedIds.length === 1 ? parts.find((p) => p.id === selectedIds[0]) : undefined;
}

export const findPart = (parts: readonly Part[], id: PartId): Part | undefined => parts.find((p) => p.id === id);

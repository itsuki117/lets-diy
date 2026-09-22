import { MeshBasicMaterial, MeshStandardMaterial, DoubleSide, LineBasicMaterial } from 'three';
import type { MaterialKind } from '../../core/types';

export const MATERIAL_COLORS: Record<MaterialKind, number> = {
  plywood: 0xd9b382,
  pine: 0xe6c79a,
  lauan: 0xc99b6e,
  mdf: 0xbfa98c,
  generic: 0xd0c0a8,
};

export const MATERIAL_LABELS: Record<MaterialKind, string> = {
  plywood: '合板',
  pine: '松・SPF',
  lauan: 'ラワン',
  mdf: 'MDF',
  generic: 'その他',
};

export const SELECTION_COLOR = 0xff8c32;
export const PREVIEW_COLOR = 0xff4444;
export const FACE_HIGHLIGHT_COLOR = 0x6fb3e0;

const base = new Map<MaterialKind, MeshStandardMaterial>();
const hovered = new Map<MaterialKind, MeshStandardMaterial>();

/** 部材ごとに new せず、材質ごとに 1 インスタンスを共有する（設計書 §3.7） */
export function getPartMaterial(kind: MaterialKind, isHovered: boolean): MeshStandardMaterial {
  const cache = isHovered ? hovered : base;
  let material = cache.get(kind);
  if (!material) {
    material = new MeshStandardMaterial({
      color: MATERIAL_COLORS[kind],
      roughness: 0.78,
      metalness: 0.02,
      emissive: isHovered ? 0x2a2418 : 0x000000,
    });
    cache.set(kind, material);
  }
  return material;
}

export const outlineMaterial = new LineBasicMaterial({ color: SELECTION_COLOR, depthTest: false, transparent: true });

export const previewMaterial = new MeshBasicMaterial({
  color: PREVIEW_COLOR,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  side: DoubleSide,
});

export const faceHighlightMaterial = new MeshBasicMaterial({
  color: FACE_HIGHLIGHT_COLOR,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
  side: DoubleSide,
});

export const faceSelectedMaterial = new MeshBasicMaterial({
  color: SELECTION_COLOR,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  side: DoubleSide,
});

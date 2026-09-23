import { DEFAULT_KERF_MM } from '../constants';
import { hashPartShape } from '../part/partHash';
import type { Part, PartId } from '../types';
import type { StockSheet } from './stockSheets';

export interface NestedPiece { partIds: PartId[]; x: number; y: number; width: number; height: number; rotated: boolean; label: string }
export interface NestedSheet { sheet: StockSheet; index: number; pieces: NestedPiece[]; usage: number }
export interface NestingResult { sheets: NestedSheet[]; unplaced: Array<{ partIds: PartId[]; label: string; reason: string }> }

interface Item { partIds: PartId[]; label: string; material: Part['material']; thickness: number; width: number; height: number }
interface Shelf { y: number; height: number; nextX: number }

export function nestParts(parts: readonly Part[], stocks: readonly StockSheet[], kerf = DEFAULT_KERF_MM): NestingResult {
  const grouped = new Map<string, Item>();
  for (const part of parts.filter((item) => item.visible)) {
    const dims = [part.size.x, part.size.y, part.size.z].sort((a, b) => b - a);
    const key = `${part.material}:${hashPartShape(part)}`;
    const existing = grouped.get(key);
    if (existing) existing.partIds.push(part.id);
    else grouped.set(key, { partIds: [part.id], label: part.name, material: part.material, thickness: dims[2]!, width: dims[0]!, height: dims[1]! });
  }
  const sheets: NestedSheet[] = [];
  const shelves = new Map<NestedSheet, Shelf[]>();
  const sheetGroups = new Map<NestedSheet, string>();
  const unplaced: NestingResult['unplaced'] = [];
  // 同形状は一度まとめてから数量ぶん展開する。棚への占有は 1 枚ずつ必要なので、
  // まとめたまま 1 区画として扱うと複数部材が同じ場所に重なってしまう。
  const items = [...grouped.values()]
    .flatMap((item) => item.partIds.map((partId) => ({ ...item, partIds: [partId] })))
    .sort((a, b) => b.height - a.height || b.width - a.width);

  for (const item of items) {
    const candidates = stocks.filter((stock) => Math.abs(stock.thickness - item.thickness) < 1e-6);
    const stock = candidates.find((candidate) =>
      (item.width <= candidate.width && item.height <= candidate.height) ||
      (item.height <= candidate.width && item.width <= candidate.height));
    if (!stock) {
      unplaced.push({ partIds: item.partIds, label: item.label, reason: '対応する厚みの定尺板に収まりません' });
      continue;
    }
    let placed = false;
    const groupKey = `${item.material}:${item.thickness}`;
    const matching = sheets.filter((sheet) => sheet.sheet.id === stock.id && sheet.sheet.thickness === stock.thickness && sheetGroups.get(sheet) === groupKey);
    for (const target of matching) {
      const targetShelves = shelves.get(target)!;
      for (const shelf of targetShelves) {
        const variants = [{ w: item.width, h: item.height, rotated: false }, { w: item.height, h: item.width, rotated: true }];
        const variant = variants.find((v) => v.h <= shelf.height && shelf.nextX + v.w <= stock.width);
        if (!variant) continue;
        target.pieces.push({ partIds: item.partIds, x: shelf.nextX, y: shelf.y, width: variant.w, height: variant.h, rotated: variant.rotated, label: item.label });
        shelf.nextX += variant.w + kerf;
        placed = true;
        break;
      }
      if (placed) break;
      const usedHeight = targetShelves.reduce((max, shelf) => Math.max(max, shelf.y + shelf.height), 0);
      const variants = [{ w: item.width, h: item.height, rotated: false }, { w: item.height, h: item.width, rotated: true }];
      const variant = variants.find((v) => v.w <= stock.width && usedHeight + (targetShelves.length ? kerf : 0) + v.h <= stock.height);
      if (variant) {
        const y = usedHeight + (targetShelves.length ? kerf : 0);
        targetShelves.push({ y, height: variant.h, nextX: variant.w + kerf });
        target.pieces.push({ partIds: item.partIds, x: 0, y, width: variant.w, height: variant.h, rotated: variant.rotated, label: item.label });
        placed = true;
        break;
      }
    }
    if (!placed) {
      const target: NestedSheet = { sheet: stock, index: matching.length + 1, pieces: [], usage: 0 };
      const rotated = item.width > stock.width;
      const width = rotated ? item.height : item.width;
      const height = rotated ? item.width : item.height;
      target.pieces.push({ partIds: item.partIds, x: 0, y: 0, width, height, rotated, label: item.label });
      sheets.push(target);
      shelves.set(target, [{ y: 0, height, nextX: width + kerf }]);
      sheetGroups.set(target, groupKey);
    }
  }
  for (const sheet of sheets) {
    const used = sheet.pieces.reduce((sum, piece) => sum + piece.width * piece.height * piece.partIds.length, 0);
    sheet.usage = Math.min(1, used / (sheet.sheet.width * sheet.sheet.height));
  }
  return { sheets, unplaced };
}

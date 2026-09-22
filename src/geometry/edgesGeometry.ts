import { BoxGeometry, EdgesGeometry, type BufferGeometry } from 'three';

/**
 * 選択中の部材を示すアウトライン。
 *
 * 当初は加工後メッシュの EdgesGeometry を使ったが、CSG の出力には T 字接合
 * （辺の途中に他の三角形の頂点が乗る）が避けられず、頂点を統合しても
 * 面内の分割線が残って見た目が汚くなる。
 *
 * Ver.1 では CAD で一般的な「バウンディングボックスの枠」を採用する。
 * 常に 12 本の直線で、切断すれば枠も縮む。穴や切り欠きの形までは追わないが、
 * 選択状態と部材の占有範囲を伝えるという目的には十分で、計算も一定コストで済む。
 */
export function createEdgesGeometry(geometry: BufferGeometry): BufferGeometry {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return new EdgesGeometry(geometry, 15);

  const sx = Math.max(box.max.x - box.min.x, 1e-3);
  const sy = Math.max(box.max.y - box.min.y, 1e-3);
  const sz = Math.max(box.max.z - box.min.z, 1e-3);
  const outline = new BoxGeometry(sx, sy, sz);
  outline.translate((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);

  const edges = new EdgesGeometry(outline, 15);
  outline.dispose();
  return edges;
}

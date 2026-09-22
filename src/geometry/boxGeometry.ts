import { BoxGeometry, type BufferGeometry } from 'three';
import type { Size3 } from '../core/types';

/**
 * 中心原点の直方体。CSG に渡すため uv は落として属性構成を揃える。
 */
export function createBoxGeometry(size: Size3): BufferGeometry {
  const g = new BoxGeometry(size.x, size.y, size.z);
  g.deleteAttribute('uv');
  return g;
}

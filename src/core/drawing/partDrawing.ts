import { axisOf, otherAxes } from '../math/axis';
import type { AxisKey, Operation, Part } from '../types';

const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const coord = (value: number, size: number, scale: number): number => 50 + (value + size / 2) * scale;
const axisIndex = (axis: AxisKey): 0 | 1 | 2 => axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

function operationFace(op: Operation): AxisKey {
  if ('direction' in op) return axisOf(op.direction);
  if (op.type === 'cut') return op.axis;
  return 'z';
}

export function partDrawingSvg(part: Part, options: { scale?: number } = {}): string {
  const dimensions = [part.size.x, part.size.y, part.size.z];
  const faceAxis: AxisKey = dimensions[0]! * dimensions[1]! >= Math.max(dimensions[0]! * dimensions[2]!, dimensions[1]! * dimensions[2]!) ? 'z' : dimensions[0]! * dimensions[2]! >= dimensions[1]! * dimensions[2]! ? 'y' : 'x';
  const [uAxis, vAxis] = otherAxes(faceAxis);
  const uSize = dimensions[axisIndex(uAxis)]!;
  const vSize = dimensions[axisIndex(vAxis)]!;
  const scale = options.scale ?? Math.min(1, 720 / Math.max(uSize, 1), 520 / Math.max(vSize, 1));
  const width = uSize * scale + 100;
  const height = vSize * scale + 120;
  const shapes: string[] = [`<rect x="50" y="50" width="${uSize * scale}" height="${vSize * scale}" fill="none" stroke="#000"/>`];
  const labels: string[] = [];
  let labelY = 76;
  for (const op of part.operations.filter((item) => item.enabled)) {
    const back = 'direction' in op && op.direction.startsWith('+') ? ' 裏' : '';
    const depth = 'through' in op && !op.through ? ` 深さ${op.depth}mm` : '';
    if ('position' in op && operationFace(op) === faceAxis) {
      const x = coord(op.position[axisIndex(uAxis)]!, uSize, scale);
      const y = 50 + vSize * scale - (op.position[axisIndex(vAxis)]! + vSize / 2) * scale;
      if (op.type === 'roundHole') shapes.push(`<circle cx="${x}" cy="${y}" r="${op.diameter * scale / 2}" fill="none" stroke="#000"/><path d="M${x - 8} ${y}h16M${x} ${y - 8}v16" stroke="#000"/>`);
      else if (op.type === 'rectHole' || op.type === 'arch') shapes.push(`<rect x="${x - op.width * scale / 2}" y="${y - op.height * scale / 2}" width="${op.width * scale}" height="${op.height * scale}" fill="none" stroke="#000"/>`);
      else if (op.type === 'notch') shapes.push(`<rect x="${x - op.size.x * scale / 2}" y="${y - op.size.y * scale / 2}" width="${op.size.x * scale}" height="${op.size.y * scale}" fill="none" stroke="#000"/>`);
      labels.push(`${op.type === 'roundHole' ? `φ${op.diameter}` : op.type === 'notch' ? `${op.size.x}×${op.size.y}` : `${op.width}×${op.height}`} / 左${(op.position[axisIndex(uAxis)]! + uSize / 2).toFixed(1)} / 下${(op.position[axisIndex(vAxis)]! + vSize / 2).toFixed(1)}${depth}${back}`);
    } else if (op.type === 'roundCorner') labels.push(`角丸 R${op.radius} ${op.corners.join(',')}`);
    else if (op.type === 'cut') labels.push(`切断 ${op.axis.toUpperCase()} ${op.offset}mm${op.tiltDeg ? ` 傾き${op.tiltDeg}°` : ''}`);
  }
  for (const label of labels) { shapes.push(`<text x="${uSize * scale + 60}" y="${labelY}" font-size="12">${esc(label)}</text>`); labelY += 18; }
  shapes.push(`<text x="50" y="30" font-size="15">${esc(part.name)} — ${uSize} × ${vSize} mm</text>`);
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><style>text{font-family:sans-serif;fill:#000}</style>${shapes.join('')}</svg>`;
}

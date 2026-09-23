import { describe, expect, it } from 'vitest';
import { nestingDrawingSvg } from '../drawing/nestingDrawing';
import { partDrawingSvg } from '../drawing/partDrawing';
import { nestParts } from '../nesting/nestParts';
import { makePart } from './fixtures';

describe('Ver.2 SVG outputs', () => {
  it('draws hole dimensions, depth and back-face marker', () => {
    const part = makePart();
    part.operations.push({ id: 'op', type: 'roundHole', enabled: true, diameter: 35, depth: 11.5, through: false, position: [10, 20, 0], direction: '+z' });
    const svg = partDrawingSvg(part);
    expect(svg).toContain('φ35');
    expect(svg).toContain('深さ11.5mm');
    expect(svg).toContain('裏');
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
  });

  it('creates parseable nesting SVG', () => {
    const result = nestParts([makePart({ size: { x: 40, y: 30, z: 18 } })], [{ id: 's', label: '定尺', width: 100, height: 100, thickness: 18 }]);
    const svg = nestingDrawingSvg(result);
    expect(svg).toContain('歩留まり');
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
  });
});

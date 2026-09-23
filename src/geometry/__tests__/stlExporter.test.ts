import { describe, expect, it } from 'vitest';
import { BoxGeometry } from 'three';
import { exportStl } from '../exporters/stlExporter';

describe('exportStl', () => {
  it('writes binary STL whose length matches its triangle count', () => {
    const geometry = new BoxGeometry(10, 20, 30);
    const output = exportStl([{ geometry, transform: { position: [5, 0, 0], rotation: [0, 0, 0] } }], true);
    expect(output).toBeInstanceOf(ArrayBuffer);
    const view = new DataView(output as ArrayBuffer);
    const triangles = view.getUint32(80, true);
    expect((output as ArrayBuffer).byteLength).toBe(84 + triangles * 50);
    geometry.dispose();
  });
});

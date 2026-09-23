import type { HardwarePreset } from '../types';

export const HARDWARE_PRESETS: readonly HardwarePreset[] = [
  {
    presetId: 'hinge.concealed.35', label: 'スライド丁番 カップ径35', kind: 'hinge',
    partNumber: 'SH-35', jointKind: 'revolute', defaultRange: { min: 0, max: 110 },
    holes: [
      { target: 'moving', shape: 'round', width: 35, depth: 11.5, through: false, offset: [0, 0, 0] },
      { target: 'base', shape: 'round', width: 3, depth: 12, through: false, offset: [0, -22.5, 0] },
      { target: 'base', shape: 'round', width: 3, depth: 12, through: false, offset: [0, 22.5, 0] },
    ],
  },
  {
    presetId: 'hinge.butt.64', label: '平丁番 64', kind: 'hinge', partNumber: 'BH-64',
    jointKind: 'revolute', defaultRange: { min: 0, max: 180 },
    holes: [-24, -8, 8, 24].map((y, index) => ({
      target: index < 2 ? 'base' as const : 'moving' as const,
      shape: 'round' as const, width: 3, depth: 8, through: false, offset: [0, y, 0] as const,
    })),
  },
  {
    presetId: 'slide.side.350', label: '側面レール 350', kind: 'slideRail', partNumber: 'SR-350',
    jointKind: 'prismatic', defaultRange: { min: 0, max: 350 },
    holes: [0, 175, 350].flatMap((x) => [
      { target: 'base' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x - 175, 0, 0] as const },
      { target: 'moving' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x - 175, 0, 0] as const },
    ]),
  },
  {
    presetId: 'slide.undermount.400', label: '底付レール 400', kind: 'slideRail', partNumber: 'UR-400',
    jointKind: 'prismatic', defaultRange: { min: 0, max: 400 },
    holes: [0, 200].flatMap((x) => [
      { target: 'base' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x - 100, 0, 0] as const },
      { target: 'moving' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x - 100, 0, 0] as const },
    ]),
  },
  {
    presetId: 'gas.100n.250', label: 'ガススプリング 100N', kind: 'gasSpring', partNumber: 'GS-100-250',
    jointKind: 'fixed', gasSpring: { strokeMin: 250, strokeMax: 400, forceN: 100 }, holes: [
      { target: 'base', shape: 'round', width: 5, depth: 10, through: false, offset: [0, 0, 0] },
      { target: 'moving', shape: 'round', width: 5, depth: 10, through: false, offset: [150, 0, 0] },
    ],
  },
] as const;

export const getHardwarePreset = (presetId: string): HardwarePreset | undefined =>
  HARDWARE_PRESETS.find((preset) => preset.presetId === presetId);

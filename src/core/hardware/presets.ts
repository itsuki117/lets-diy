import type { HardwareHole, HardwarePreset } from '../types';

const screw = (target: 'base' | 'moving', x: number, y: number, width = 4): HardwareHole =>
  ({ target, shape: 'round', width, depth: 10, through: false, offset: [x, y, 0] });

/** リニアガイド: レールのネジはピッチ 60、ブロックは下端（可動量 0）の位置で 4 本 */
function linearGuideHoles(rail: number, block: number): HardwareHole[] {
  const count = Math.floor((rail - 40) / 60) + 1;
  const start = -((count - 1) * 60) / 2;
  const blockCenter = -rail / 2 + block / 2;
  return [
    ...Array.from({ length: count }, (_, i) => screw('base', start + i * 60, 0, 4.5)),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sy) => screw('moving', blockCenter + sx * block * 0.25, sy * 13))),
  ];
}

/**
 * 内蔵プリセット。寸法・力はカタログ値の代表例（設計書 DESIGN_V2 §10.1）。
 *
 * 金物ローカル座標の約束（mechanism.ts と共通）:
 *   丁番     原点 = ピン（回転軸）上 / +Y = ピンの向き / +X = 扉の内側へ向かう向き / +Z = 扉の表側
 *   レール   原点 = レールの中心 / +X = 引き出す向き / +Z = 取付面から離れる向き
 *   リニア   原点 = レールの中心 / +X = 動く向き（上下なら上） / +Z = 取付面から離れる向き
 *   ガス     穴は取付点（baseAnchor / movingAnchor）に開ける。offset は使わない
 *   ロック   原点 = 受け金具とストライカーが噛み合う点 / +X = ロック位置へ向かう動きの向き
 *   固定     原点 = 2 部材の内側の角 / +X = 固定側の面に沿う脚 / +Y = 取り付ける側の面に沿う脚
 */
export const HARDWARE_PRESETS: readonly HardwarePreset[] = [
  {
    presetId: 'hinge.concealed.35', label: 'スライド丁番 カップ径35', kind: 'hinge',
    partNumber: 'SH-35', jointKind: 'revolute', defaultRange: { min: 0, max: 110 }, motionAxis: [0, 1, 0],
    holes: [
      // カップ穴: 扉の端から 22.5mm（カップ縁まで 5mm）
      { target: 'moving', shape: 'round', width: 35, depth: 11.5, through: false, offset: [22.5, 0, 0] },
      // 座金のネジ: 側板の前端から 37mm、ピッチ 32mm
      { target: 'base', shape: 'round', width: 3, depth: 12, through: false, offset: [0, -16, -37] },
      { target: 'base', shape: 'round', width: 3, depth: 12, through: false, offset: [0, 16, -37] },
    ],
  },
  {
    presetId: 'hinge.butt.64', label: '平丁番 64', kind: 'hinge', partNumber: 'BH-64',
    jointKind: 'revolute', defaultRange: { min: 0, max: 180 }, motionAxis: [0, 1, 0],
    holes: [-22, 22].flatMap((y) => [
      { target: 'base' as const, shape: 'round' as const, width: 3, depth: 8, through: false, offset: [-15, y, 0] as const },
      { target: 'moving' as const, shape: 'round' as const, width: 3, depth: 8, through: false, offset: [15, y, 0] as const },
    ]),
  },
  {
    presetId: 'slide.side.350', label: '側面レール 350（フルスライド）', kind: 'slideRail', partNumber: 'SR-350',
    jointKind: 'prismatic', defaultRange: { min: 0, max: 350 }, motionAxis: [1, 0, 0], railLength: 350, mountGap: 12.7,
    holes: [-140, 0, 140].flatMap((x) => [
      { target: 'base' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x, 0, 0] as const },
      { target: 'moving' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x, 0, 0] as const },
    ]),
  },
  {
    presetId: 'slide.undermount.400', label: '底付レール 400（3/4スライド）', kind: 'slideRail', partNumber: 'UR-400',
    jointKind: 'prismatic', defaultRange: { min: 0, max: 300 }, motionAxis: [1, 0, 0], railLength: 400,
    holes: [-150, 150].flatMap((x) => [
      { target: 'base' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x, 0, 0] as const },
      { target: 'moving' as const, shape: 'round' as const, width: 4, depth: 10, through: false, offset: [x, 0, 0] as const },
    ]),
  },
  {
    presetId: 'linear.guide.500', label: 'リニアガイド 500（ブロック1個）', kind: 'linearGuide', partNumber: 'LG15-500',
    jointKind: 'prismatic', defaultRange: { min: 0, max: 440 }, motionAxis: [1, 0, 0], railLength: 500, blockLength: 60, mountGap: 28,
    holes: linearGuideHoles(500, 60),
  },
  {
    presetId: 'linear.guide.800', label: 'リニアガイド 800（ブロック1個）', kind: 'linearGuide', partNumber: 'LG15-800',
    jointKind: 'prismatic', defaultRange: { min: 0, max: 720 }, motionAxis: [1, 0, 0], railLength: 800, blockLength: 80, mountGap: 28,
    holes: linearGuideHoles(800, 80),
  },
  {
    presetId: 'gas.100n.250', label: 'ガススプリング 100N（持ち上げ補助）', kind: 'gasSpring', partNumber: 'GS-100-250',
    jointKind: 'fixed',
    gasSpring: { strokeMin: 250, strokeMax: 400, forceN: 100, type: 'push', progression: 1.3, extendSpeed: 200 },
    holes: [
      { target: 'base', shape: 'round', width: 5, depth: 10, through: false, offset: [0, 0, 0] },
      { target: 'moving', shape: 'round', width: 5, depth: 10, through: false, offset: [0, 0, 0] },
    ],
  },
  {
    presetId: 'gas.50n.165', label: 'ガススプリング 50N 小型', kind: 'gasSpring', partNumber: 'GS-50-165',
    jointKind: 'fixed',
    gasSpring: { strokeMin: 165, strokeMax: 245, forceN: 50, type: 'push', progression: 1.25, extendSpeed: 150 },
    holes: [
      { target: 'base', shape: 'round', width: 4, depth: 10, through: false, offset: [0, 0, 0] },
      { target: 'moving', shape: 'round', width: 4, depth: 10, through: false, offset: [0, 0, 0] },
    ],
  },
  {
    presetId: 'gas.150n.400', label: 'ガススプリング 150N ロング（昇降の補助）', kind: 'gasSpring', partNumber: 'GS-150-400',
    jointKind: 'fixed',
    gasSpring: { strokeMin: 400, strokeMax: 700, forceN: 150, type: 'push', progression: 1.35, extendSpeed: 250 },
    holes: [
      { target: 'base', shape: 'round', width: 6, depth: 12, through: false, offset: [0, 0, 0] },
      { target: 'moving', shape: 'round', width: 6, depth: 12, through: false, offset: [0, 0, 0] },
    ],
  },
  {
    presetId: 'gas.lock.150n', label: 'ロック付ガススプリング 150N（任意位置で固定）', kind: 'gasSpring', partNumber: 'GSL-150-250',
    jointKind: 'fixed',
    gasSpring: { strokeMin: 250, strokeMax: 400, forceN: 150, type: 'locking', progression: 1.35, extendSpeed: 150 },
    holes: [
      { target: 'base', shape: 'round', width: 5, depth: 10, through: false, offset: [0, 0, 0] },
      { target: 'moving', shape: 'round', width: 5, depth: 10, through: false, offset: [0, 0, 0] },
    ],
  },
  {
    presetId: 'gas.traction.80n', label: '引張型ガススプリング 80N（引き込み・閉じ保持）', kind: 'gasSpring', partNumber: 'GST-80-200',
    jointKind: 'fixed',
    gasSpring: { strokeMin: 200, strokeMax: 300, forceN: 80, type: 'traction', progression: 1.3, extendSpeed: 150 },
    holes: [
      { target: 'base', shape: 'round', width: 5, depth: 10, through: false, offset: [0, 0, 0] },
      { target: 'moving', shape: 'round', width: 5, depth: 10, through: false, offset: [0, 0, 0] },
    ],
  },
  {
    presetId: 'damper.flap.20n', label: '油圧ダンパー（減速・ソフトダウン）', kind: 'gasSpring', partNumber: 'OD-180',
    jointKind: 'fixed',
    // 戻し用の弱いガス圧 + 強い油圧減衰。フラップ扉の落下やフタの閉まりをゆっくりにする
    gasSpring: { strokeMin: 180, strokeMax: 260, forceN: 15, type: 'damper', progression: 1.1, extendSpeed: 25, dampDirection: 'both' },
    holes: [
      { target: 'base', shape: 'round', width: 4, depth: 10, through: false, offset: [0, 0, 0] },
      { target: 'moving', shape: 'round', width: 4, depth: 10, through: false, offset: [0, 0, 0] },
    ],
  },
  {
    presetId: 'latch.auto', label: 'ドアロック 自動（位置で掛かる・レバーで外す）', kind: 'latch', partNumber: 'DL-A',
    jointKind: 'fixed', latchMode: 'auto',
    holes: [screw('base', 10, -12), screw('base', 10, 12), screw('moving', -10, -10), screw('moving', -10, 10)],
  },
  {
    presetId: 'latch.bolt', label: 'スライドボルト（位置で手で掛ける）', kind: 'latch', partNumber: 'SB-50',
    jointKind: 'fixed', latchMode: 'manual',
    holes: [screw('base', 10, -12), screw('base', 10, 12), screw('moving', -10, -10), screw('moving', -10, 10)],
  },
  {
    presetId: 'bracket.l.40', label: 'L字金具 40', kind: 'bracket', partNumber: 'LB-40',
    jointKind: 'fixed', bracketLeg: 40,
    holes: [screw('base', 13, 0), screw('base', 29, 0), screw('moving', 0, 13), screw('moving', 0, 29)],
  },
  {
    presetId: 'bracket.l.75', label: 'L字金具 75', kind: 'bracket', partNumber: 'LB-75',
    jointKind: 'fixed', bracketLeg: 75,
    holes: [screw('base', 20, 0), screw('base', 55, 0), screw('moving', 0, 20), screw('moving', 0, 55)],
  },
] as const;

export const getHardwarePreset = (presetId: string): HardwarePreset | undefined =>
  HARDWARE_PRESETS.find((preset) => preset.presetId === presetId);

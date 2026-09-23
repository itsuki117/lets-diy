import { z } from 'zod';
import { MAX_SIZE_MM, MIN_SIZE_MM } from '../constants';

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const axisKey = z.enum(['x', 'y', 'z']);
const axisDirection = z.enum(['+x', '-x', '+y', '-y', '+z', '-z']);

const size3 = z.object({
  x: z.number().min(MIN_SIZE_MM).max(MAX_SIZE_MM),
  y: z.number().min(MIN_SIZE_MM).max(MAX_SIZE_MM),
  z: z.number().min(MIN_SIZE_MM).max(MAX_SIZE_MM),
});

const operationBase = { id: z.string().min(1), enabled: z.boolean(), note: z.string().optional() };

const operation = z.discriminatedUnion('type', [
  z.object({
    ...operationBase,
    type: z.literal('roundHole'),
    diameter: z.number().positive(),
    depth: z.number().nonnegative(),
    through: z.boolean(),
    position: vec3,
    direction: axisDirection,
  }),
  z.object({
    ...operationBase,
    type: z.literal('rectHole'),
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().nonnegative(),
    through: z.boolean(),
    position: vec3,
    direction: axisDirection,
    rotation: z.number().finite(),
  }),
  z.object({
    ...operationBase,
    type: z.literal('arch'),
    width: z.number().positive(),
    height: z.number().positive(),
    rise: z.number().nonnegative(),
    depth: z.number().nonnegative(),
    through: z.boolean(),
    position: vec3,
    direction: axisDirection,
    rotation: z.number().finite(),
  }),
  z.object({
    ...operationBase,
    type: z.literal('roundCorner'),
    radius: z.number().positive(),
    direction: axisDirection,
    corners: z.array(z.enum(['bottomLeft', 'bottomRight', 'topLeft', 'topRight'])).min(1),
  }),
  z.object({
    ...operationBase,
    type: z.literal('notch'),
    size: z.object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() }),
    position: vec3,
  }),
  z.object({
    ...operationBase,
    type: z.literal('cut'),
    axis: axisKey,
    offset: z.number().finite(),
    keep: z.enum(['negative', 'positive']),
    tiltAbout: axisKey.optional(),
    tiltDeg: z.number().min(-89).max(89).optional(),
  }),
]);

const part = z.object({
  id: z.string().min(1),
  kind: z.literal('wood'),
  name: z.string(),
  size: size3,
  transform: z.object({ position: vec3, rotation: vec3 }),
  material: z.enum(['plywood', 'pine', 'lauan', 'mdf', 'generic']),
  operations: z.array(operation),
  visible: z.boolean(),
  locked: z.boolean(),
  createdAt: z.string(),
});

const jointBase = {
  id: z.string().min(1),
  name: z.string(),
  enabled: z.boolean(),
  basePartId: z.string().min(1),
  movingPartId: z.string().min(1),
};

const range = z.object({ min: z.number().finite(), max: z.number().finite() });

const joint = z
  .discriminatedUnion('kind', [
    z.object({ ...jointBase, kind: z.literal('fixed') }),
    z.object({
      ...jointBase,
      kind: z.literal('revolute'),
      origin: vec3,
      axis: vec3,
      value: z.number().finite(),
      range,
    }),
    z.object({
      ...jointBase,
      kind: z.literal('prismatic'),
      axis: vec3,
      value: z.number().finite(),
      range,
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.basePartId === value.movingPartId) {
      ctx.addIssue({ code: 'custom', message: '同じ部材どうしは結合できません', path: ['movingPartId'] });
    }
    if (value.kind !== 'fixed' && value.range.min > value.range.max) {
      ctx.addIssue({ code: 'custom', message: '可動範囲の最小が最大を超えています', path: ['range'] });
    }
  });

const hardwareHole = z.object({
  target: z.enum(['base', 'moving']),
  shape: z.enum(['round', 'rect']),
  width: z.number().positive(),
  height: z.number().positive().optional(),
  depth: z.number().positive(),
  through: z.boolean(),
  offset: vec3,
});

const hardwarePreset = z.object({
  presetId: z.string().min(1),
  label: z.string(),
  kind: z.enum(['hinge', 'slideRail', 'gasSpring']),
  partNumber: z.string().optional(),
  jointKind: z.enum(['fixed', 'revolute', 'prismatic']),
  defaultRange: range.optional(),
  holes: z.array(hardwareHole),
  gasSpring: z.object({ strokeMin: z.number().positive(), strokeMax: z.number().positive(), forceN: z.number().positive() }).optional(),
});

const hardware = z.object({
  id: z.string().min(1),
  preset: hardwarePreset,
  jointId: z.string().min(1).nullable(),
  position: vec3,
  rotation: vec3,
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

const gasSpring = z.object({
  id: z.string().min(1),
  hardwareId: z.string().min(1),
  jointId: z.string().min(1),
  baseAnchor: vec3,
  movingAnchor: vec3,
  strokeMin: z.number().positive(),
  strokeMax: z.number().positive(),
  forceN: z.number().positive(),
});

const project = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    unit: z.literal('mm'),
    parts: z.array(part),
    joints: z.array(joint),
    hardware: z.array(hardware),
    gasSprings: z.array(gasSpring),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    for (const p of value.parts) {
      if (ids.has(p.id)) {
        ctx.addIssue({ code: 'custom', message: `部材 ID が重複しています: ${p.id}`, path: ['parts'] });
      }
      ids.add(p.id);
      const opIds = new Set<string>();
      for (const op of p.operations) {
        if (opIds.has(op.id)) {
          ctx.addIssue({ code: 'custom', message: `加工 ID が重複しています: ${op.id}`, path: ['parts'] });
        }
        opIds.add(op.id);
      }
    }

    const partIds = new Set(value.parts.map((p) => p.id));
    const jointIds = new Set<string>();
    const driven = new Set<string>();
    for (const j of value.joints) {
      if (jointIds.has(j.id)) {
        ctx.addIssue({ code: 'custom', message: `joint ID が重複しています: ${j.id}`, path: ['joints'] });
      }
      jointIds.add(j.id);
      if (!partIds.has(j.basePartId) || !partIds.has(j.movingPartId)) {
        ctx.addIssue({ code: 'custom', message: `joint が存在しない部材を指しています: ${j.id}`, path: ['joints'] });
      }
      if (driven.has(j.movingPartId)) {
        ctx.addIssue({
          code: 'custom',
          message: `1 つの部材が複数の joint で動かされています: ${j.movingPartId}`,
          path: ['joints'],
        });
      }
      driven.add(j.movingPartId);
    }

    for (const h of value.hardware) {
      if (h.jointId !== null && !jointIds.has(h.jointId)) {
        ctx.addIssue({ code: 'custom', message: `金物が存在しない joint を指しています: ${h.id}`, path: ['hardware'] });
      }
    }
    for (const g of value.gasSprings) {
      if (!jointIds.has(g.jointId)) {
        ctx.addIssue({ code: 'custom', message: `ガススプリングが存在しない joint を指しています: ${g.id}`, path: ['gasSprings'] });
      }
      if (g.strokeMin >= g.strokeMax) {
        ctx.addIssue({ code: 'custom', message: '縮んだ長さが伸びた長さ以上です', path: ['gasSprings'] });
      }
    }
  });

export const projectDocumentSchema = z.object({
  app: z.literal('lets-diy'),
  schemaVersion: z.number().int().positive(),
  savedAt: z.string(),
  project,
});

export type ParsedProjectDocument = z.infer<typeof projectDocumentSchema>;

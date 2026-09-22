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

const project = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    unit: z.literal('mm'),
    parts: z.array(part),
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
  });

export const projectDocumentSchema = z.object({
  app: z.literal('lets-diy'),
  schemaVersion: z.number().int().positive(),
  savedAt: z.string(),
  project,
});

export type ParsedProjectDocument = z.infer<typeof projectDocumentSchema>;

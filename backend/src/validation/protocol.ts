import { z } from 'zod';

const square = z.string().regex(/^[a-h][1-8]$/);
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    profile: z.object({
      login: z
        .string()
        .trim()
        .min(3)
        .max(24)
        .regex(/^[a-zA-Z0-9_-]+$/),
      name: z.string().trim().min(1).max(40),
    }),
    sessionId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.object({ type: z.literal('create_room') }),
  z.object({
    type: z.literal('join_room'),
    roomId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6}$/),
  }),
  z.object({ type: z.literal('leave_room') }),
  z.object({ type: z.literal('resign') }),
  z.object({
    type: z.literal('move'),
    from: square,
    to: square,
    promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
    revision: z.number().int().nonnegative(),
  }),
]);

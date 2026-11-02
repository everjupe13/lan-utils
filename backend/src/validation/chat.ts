import { z } from 'zod';

const name = z.string().trim().min(1).max(40);
const id = z.string().min(1).max(80);
export const chatMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    name,
    kind: z.enum(['phone', 'tablet', 'computer', 'unknown']),
    sessionToken: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.object({ type: z.literal('create_room'), title: name }),
  z.object({ type: z.literal('open_conversation'), conversationId: id }),
  z.object({ type: z.literal('open_direct'), deviceId: id }),
  z.object({ type: z.literal('rename_device'), name }),
  z.object({
    type: z.literal('send_message'),
    conversationId: id,
    clientMessageId: id,
    text: z.string().trim().min(1).max(4000),
  }),
]);

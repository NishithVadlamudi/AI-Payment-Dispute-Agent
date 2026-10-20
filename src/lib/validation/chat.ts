import { z } from 'zod';
import { MAX_MESSAGE_LENGTH, MAX_CONVERSATION_LENGTH } from '../security/limits';

export const chatRequestSchema = z
  .strictObject({
    customer_id: z.uuid(),
    messages: z
      .array(
        z.strictObject({
          role: z.enum(['user', 'assistant']),
          content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine(
    (request) => request.messages.reduce((total, message) => total + message.content.length, 0) <= MAX_CONVERSATION_LENGTH,
    'The conversation is too long. Start a new chat.',
  )
  .refine(
    (request) => request.messages.at(-1)?.role === 'user',
    'The last message must be from the user.',
  );
export type ChatRequest = z.infer<typeof chatRequestSchema>;

import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "../db/client";
import type { ModelClient, ModelRequest } from "../agent/types";
import { MAX_MODEL_CONTEXT_BYTES, MAX_OUTPUT_TOKENS } from "./limits";
import { usageSchema } from "../observability/schemas";
import type { ModelEvent } from "../agent/types";

export class SafetyLimitError extends Error {
  constructor(
    message: string,
    public readonly status = 503,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}
const integerSetting = (name: string, fallback: number, max: number) => {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new SafetyLimitError(
      "The demo’s safety limits need attention. Please try again later.",
    );
  return value;
};
const rateResult = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().positive(),
});

export function createAbuseControls(db: DatabaseClient) {
  return {
    async checkRate(bucket: string) {
      const limit = integerSetting("AI_REQUESTS_PER_MINUTE", 10, 1000);
      const { data, error } = await db.rpc("consume_ai_request", {
        p_bucket: bucket,
        p_limit: limit,
      });
      if (error)
        throw new SafetyLimitError(
          "The demo’s safety checks are temporarily unavailable. Please try again later.",
        );
      const parsed = rateResult.safeParse(data);
      if (!parsed.success)
        throw new SafetyLimitError(
          "The demo’s safety checks are temporarily unavailable.",
        );
      if (!parsed.data.allowed)
        throw new SafetyLimitError(
          "You’ve reached the demo’s request limit. Please wait a minute and try again.",
          429,
          parsed.data.retry_after_seconds,
        );
    },
    protect(
      model: ModelClient,
      observer?: { onReservation(amount: number): Promise<void> },
    ): ModelClient {
      const provider = (process.env.AI_PROVIDER || "gemini")
        .trim()
        .toLowerCase();
      if (
        model.model !==
          (process.env.AI_BUDGET_MODEL || "gemini-3.5-flash-lite") ||
        provider !== (process.env.AI_BUDGET_PROVIDER || "gemini")
      )
        throw new SafetyLimitError(
          "The selected model needs a matching budget configuration before this demo can use it.",
        );
      const cap = integerSetting(
        "AI_DAILY_BUDGET_MICROUSD",
        5_000_000,
        1_000_000_000,
      );
      // These are deliberately conservative accounting allowances, not a live
      // provider price list. One micro-USD/token equals $1 per million tokens.
      const inputRate = integerSetting("AI_INPUT_MICROUSD_PER_TOKEN", 5, 1000);
      const outputRate = integerSetting(
        "AI_OUTPUT_MICROUSD_PER_TOKEN",
        20,
        1000,
      );
      return {
        model: model.model,
        async *turn(request: ModelRequest) {
          request.signal?.throwIfAborted();
          const bytes = Buffer.byteLength(
            JSON.stringify({
              instructions: request.instructions,
              input: request.input,
              tools: request.tools,
            }),
            "utf8",
          );
          if (bytes > MAX_MODEL_CONTEXT_BYTES)
            throw new SafetyLimitError(
              "This investigation has grown too large. Check the approval queue for existing requests, then start a shorter chat.",
            );
          // UTF-8 bytes plus protocol overhead conservatively bound input tokens.
          // Reserve the full output allowance, even if a call fails/cancels.
          const amount =
            (bytes + 4096) * inputRate + MAX_OUTPUT_TOKENS * outputRate;
          const reservationId = crypto.randomUUID();
          const { data, error } = await db.rpc("reserve_ai_budget", {
            p_id: reservationId,
            p_amount_microusd: amount,
            p_cap_microusd: cap,
            p_scope: "global",
          });
          if (error)
            throw new SafetyLimitError(
              "The demo’s budget check is unavailable. Please try again later.",
            );
          if (data !== true)
            throw new SafetyLimitError(
              "The demo has reached its daily AI budget allowance. Please try again after midnight UTC. Check the approval queue for any requests already created.",
              429,
            );
          await observer?.onReservation(amount);
          request.signal?.throwIfAborted();
          let completion: Extract<ModelEvent, { type: 'completed' }> | undefined;
          let completions = 0;
          for await (const event of model.turn(request)) {
            if (event.type === 'completed') { completion = event; completions++; }
            else yield event;
          }
          request.signal?.throwIfAborted();
          // Reconcile only a normally exhausted stream with one validated usage
          // record. Errors, cancellations and missing/ambiguous usage retain the
          // full reservation. Gemini usage includes its reasoning output tokens.
          const usage = usageSchema.safeParse(completion?.usage);
          if (completions === 1 && usage.success && usage.data.inputTokens > 0) {
            const actual = usage.data.inputTokens * inputRate + usage.data.outputTokens * outputRate;
            if (Number.isSafeInteger(actual) && actual <= amount) {
              const settled = await db.rpc('settle_ai_budget', { p_id: reservationId, p_actual_microusd: actual });
              if (settled.error || settled.data !== true)
                throw new SafetyLimitError('The demo’s budget settlement could not be confirmed. Please try again later.');
            }
          }
          if (completion) yield completion;
        },
      };
    },
  };
}

/**
 * Thin wrapper around the Anthropic SDK.
 *
 * Every LLM call in the Service Writer is a single forced tool call with a JSON
 * schema derived from a zod schema. The model never returns free text that we
 * parse; it fills in the tool input, we validate it with zod, and that object is
 * the step's output. This is what keeps codes, prices and part numbers out of
 * the model's hands: it can only choose from what we show it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const MODEL = "claude-sonnet-4-6";

export class AiUnavailableError extends Error {
  constructor(message = "ANTHROPIC_API_KEY is not set. Add it to .env to enable drafting.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export class AiCallError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiCallError";
  }
}

export type UserContent = string | Anthropic.MessageParam["content"];

export interface StructuredRequest<T> {
  /** Tool name shown to the model, e.g. "record_findings". */
  name: string;
  description: string;
  system: string;
  user: UserContent;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface StructuredResult<T> {
  output: T;
  latencyMs: number;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface StructuredCaller {
  call<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

function toolInputSchema(schema: z.ZodType): Anthropic.Tool["input_schema"] {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool["input_schema"];
}

export class AnthropicStructuredCaller implements StructuredCaller {
  private client: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) throw new AiUnavailableError();
    // The SDK retries 408/409/429/5xx itself. One retry keeps the demo snappy
    // while still absorbing a transient blip.
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  }

  async call<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const started = Date.now();
    const tool: Anthropic.Tool = {
      name: req.name,
      description: req.description,
      input_schema: toolInputSchema(req.schema),
    };

    let lastError: unknown;
    // One extra attempt covers a schema-validation miss as well as an API error.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: req.maxTokens ?? 4096,
          system: req.system,
          tools: [tool],
          tool_choice: { type: "tool", name: req.name },
          messages: [{ role: "user", content: req.user }],
        });

        const block = response.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === req.name,
        );
        if (!block) throw new AiCallError("Model did not call the structured tool.");

        const parsed = req.schema.safeParse(block.input);
        if (!parsed.success) {
          throw new AiCallError(
            `Model output failed validation: ${parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`,
          );
        }
        return {
          output: parsed.data,
          latencyMs: Date.now() - started,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (err) {
        lastError = err;
        if (err instanceof Anthropic.AuthenticationError) {
          throw new AiUnavailableError("Anthropic rejected the API key. Check ANTHROPIC_API_KEY.");
        }
        if (err instanceof Anthropic.BadRequestError) throw new AiCallError(err.message, err);
        if (attempt === 0) continue;
      }
    }
    if (lastError instanceof AiCallError) throw lastError;
    if (lastError instanceof Anthropic.APIError) {
      throw new AiCallError(`Anthropic API error (${lastError.status}): ${lastError.message}`, lastError);
    }
    throw new AiCallError("Unexpected error talking to Anthropic.", lastError);
  }
}

let cached: StructuredCaller | null = null;
/** Default caller for the app. Throws AiUnavailableError when no key is configured. */
export function getAi(): StructuredCaller {
  if (!cached) cached = new AnthropicStructuredCaller();
  return cached;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** A caller for tests and fixtures: answers each call in order from a queue. */
export class FakeStructuredCaller implements StructuredCaller {
  public readonly calls: StructuredRequest<unknown>[] = [];
  constructor(private readonly responses: Record<string, unknown[]>) {}

  async call<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    this.calls.push(req as StructuredRequest<unknown>);
    const queue = this.responses[req.name];
    if (!queue || queue.length === 0) {
      throw new Error(`FakeStructuredCaller has no fixture for tool "${req.name}"`);
    }
    const raw = queue.shift();
    const output = req.schema.parse(raw);
    return { output, latencyMs: 1, model: "fixture" };
  }
}

import { z } from 'zod';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import { Runnable, RunnableLambda } from '@langchain/core/runnables';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { toJsonSchema } from '@langchain/core/utils/json_schema';

/**
 * Gemini-specific fix for a real gap in @langchain/google-genai@2.3.0's Zod-to-schema
 * converter (confirmed via the package source: utils/zod_to_genai_parameters.js strips only
 * `additionalProperties`/`$schema`/`strict`, nothing else). Zod's `.nullable()` correctly
 * produces standard JSON-Schema `{"type": ["fieldType", "null"]}`, but Gemini's live API
 * rejects that array-valued `type` with a 400 ("Proto field is not repeating, cannot start
 * list") even though Gemini's own docs describe it as supported — LangChain's Python package
 * has a `_strip_nullable_anyof()` step to work around this; the JS package does not.
 *
 * Gemini's actual (proto-native) representation of nullable is a scalar `type` plus a separate
 * `nullable: true` boolean. This walks the converted JSON schema and rewrites every
 * `type: [X, "null"]` node into that form before handing it to Gemini — the real root-cause
 * fix (a missing translation step), not a workaround baked into individual Zod schemas.
 *
 * Only applies to ChatGoogleGenerativeAI instances — schemas passed to any other provider go
 * through unmodified, since this bug is specific to Gemini's schema converter.
 */
function fixNullableTypes(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(fixNullableTypes);
  }
  if (typeof node !== 'object' || node === null) {
    return node;
  }

  const obj = { ...(node as Record<string, unknown>) };

  if (Array.isArray(obj.type)) {
    const types = obj.type as unknown[];
    const nonNull = types.filter((t) => t !== 'null');
    if (nonNull.length === 1 && types.length > nonNull.length) {
      obj.type = nonNull[0];
      obj.nullable = true;
    }
  }

  for (const key of Object.keys(obj)) {
    obj[key] = fixNullableTypes(obj[key]);
  }

  return obj;
}

/** Number of times to retry a call that fails with a malformed-output error before giving up
 *  and letting the error propagate. Provider-agnostic — this covers two related failure
 *  classes that are worth an immediate retry rather than a fixed config problem: (1) the
 *  provider itself reporting its output failed JSON/schema validation (smaller/faster models
 *  occasionally break strict-mode JSON on deeply nested objects), and (2) our own post-parse
 *  Zod validation catching a content-level miss (e.g. .refine() rejecting the wrong number of
 *  anchors) that a well-formed-JSON response can still have. Neither is something LangChain's
 *  own retry (network/rate-limit errors only) covers. */
const MALFORMED_OUTPUT_RETRIES = 2;

/** True for an error indicating the model's output failed JSON/schema validation — either at
 *  the provider level (as opposed to a network error, auth error, or rate limit) or at our own
 *  post-parse Zod validation step — worth an immediate retry since the same prompt often
 *  succeeds on a second attempt. */
function isMalformedOutputError(err: unknown): boolean {
  if (err instanceof z.ZodError) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message;
  return (
    message.includes('json_validate_failed') ||
    message.includes('Failed to generate JSON') ||
    err.name === 'SyntaxError'
  );
}

/**
 * Drop-in replacement for `model.withStructuredOutput(schema)` that:
 * 1. Gemini-patches the schema first when `model` is a ChatGoogleGenerativeAI instance
 *    (fixes a real gap in @langchain/google-genai's Zod-to-schema converter — see
 *    `fixNullableTypes` above), and otherwise delegates unchanged.
 * 2. Retries automatically (`MALFORMED_OUTPUT_RETRIES` attempts) if the output fails
 *    validation — either the provider itself reports malformed JSON (observed on Groq's
 *    smaller `gpt-oss-20b` model, which occasionally breaks strict-mode JSON on deeply nested
 *    objects even with `strict: true` set) or our own post-parse Zod `.refine()` rejects a
 *    well-formed-but-semantically-wrong response (e.g. the wrong number of anchors).
 *
 * Passing the library a raw (already-converted) JSON schema instead of the Zod schema object
 * skips its own Zod-validation output parser, so this re-validates with the original Zod
 * schema afterward — no loss of runtime validation compared to the unpatched call.
 */
export function withGeminiSafeStructuredOutput<T extends Record<string, any>>(
  model: BaseChatModel,
  schema: z.ZodType<T>,
): Runnable<BaseLanguageModelInput, T> {
  const structuredModel =
    model instanceof ChatGoogleGenerativeAI
      ? model.withStructuredOutput<Record<string, unknown>>(
          fixNullableTypes(toJsonSchema(schema)) as Record<string, unknown>,
        )
      : model.withStructuredOutput<Record<string, unknown>>(schema);

  const pipeline = structuredModel.pipe(
    RunnableLambda.from((output: unknown) => schema.parse(output)),
  );

  return RunnableLambda.from(async (input: BaseLanguageModelInput, config) => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MALFORMED_OUTPUT_RETRIES; attempt++) {
      try {
        return await pipeline.invoke(input, config);
      } catch (err) {
        lastError = err;
        if (!isMalformedOutputError(err)) throw err;
      }
    }
    throw lastError;
  });
}

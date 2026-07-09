import { Either, ParseResult, Schema } from "effect";
import { DecodeError } from "@/lib/effect/errors";

export function decodeUnknown<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: unknown,
): A {
  const decoded = Schema.decodeUnknownEither(schema)(value);
  if (Either.isRight(decoded)) return decoded.right;
  throw new DecodeError({
    message: ParseResult.TreeFormatter.formatErrorSync(decoded.left),
  });
}

export function decodeUnknownResult<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: unknown,
): { ok: true; value: A } | { ok: false; error: DecodeError } {
  const decoded = Schema.decodeUnknownEither(schema)(value);
  return Either.isRight(decoded)
    ? { ok: true, value: decoded.right }
    : {
        ok: false,
        error: new DecodeError({
          message: ParseResult.TreeFormatter.formatErrorSync(decoded.left),
        }),
      };
}

import { Effect } from "effect";

export function runEffect<A, E>(program: Effect.Effect<A, E, never>) {
  return Effect.runPromise(Effect.either(program)).then((result) => {
    if (result._tag === "Left") throw result.left;
    return result.right;
  });
}

export function runEffectSync<A, E>(program: Effect.Effect<A, E, never>) {
  return Effect.runSync(program);
}

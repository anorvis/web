import { Data } from "effect";

export class ApiError extends Data.TaggedError("ApiError")<{
  status: number;
  message: string;
  path: string;
}> {}

export class DecodeError extends Data.TaggedError("DecodeError")<{
  message: string;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  message: string;
}> {}

export type AppEffectError = ApiError | DecodeError | StorageError;

export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError ||
    (typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      error._tag === "ApiError" &&
      "status" in error &&
      typeof error.status === "number" &&
      "message" in error &&
      typeof error.message === "string")
  );
}

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof DecodeError) return error.message;
  if (error instanceof StorageError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

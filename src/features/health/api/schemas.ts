import { Schema } from "effect";

export const HealthRequestBodySchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});
export const ExerciseSetBodySchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});
export const ExerciseBodySchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});
export const ExercisesJsonSchema = Schema.parseJson(
  Schema.Array(Schema.Unknown),
);

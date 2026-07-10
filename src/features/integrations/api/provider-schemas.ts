import { Schema } from "effect";

export const ProviderIdSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9_.:-]*$/),
);

export const ProviderDefinitionInputSchema = Schema.Struct({
  id: ProviderIdSchema,
  displayName: Schema.NonEmptyString,
  category: Schema.Literal(
    "life",
    "library",
    "productivity",
    "health",
    "finance",
  ),
  capabilities: Schema.Array(Schema.NonEmptyString),
  authType: Schema.Literal("local", "oauth2", "token", "webhook"),
  enabled: Schema.optional(Schema.Boolean),
});

export const ProviderConnectionInputSchema = Schema.Struct({
  settings: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  ),
  secrets: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
});

export const SaveTokenInputSchema = Schema.Struct({
  provider: ProviderIdSchema,
  token: Schema.NonEmptyString,
});

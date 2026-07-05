import { createAnorvis } from "../../../../anorvis-sdk/src/index.ts";

const RESULT_PREFIX = "ANORVIS_SDK_RESULT ";
const RUN_STARTED_PREFIX = "ANORVIS_SDK_RUN_STARTED ";

async function readStdin() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk.toString();
  }
  return raw;
}

async function main() {
  const input = JSON.parse(await readStdin());
  const ctx = await createAnorvis({
    id: input.agent,
    payload: { prompt: input.prompt, source: "web-app" },
    cwd: input.cwd,
    repoRoot: input.repoRoot,
    os: {
      url: input.osUrl,
      token: input.osToken,
      autoStart: false,
    },
  });
  const agent = await ctx.init({
    id: input.agent,
    cwd: input.cwd,
    repoRoot: input.repoRoot,
  });
  const session = await agent.session(input.sessionId, {
    client: "web",
    piSessionId: input.piSessionId,
  });
  const result = await session.prompt(input.prompt, {
    displayText: input.displayText,
    onRunStarted: (runId) => {
      console.log(`${RUN_STARTED_PREFIX}${JSON.stringify({ runId })}`);
    },
  });
  console.log(
    `${RESULT_PREFIX}${JSON.stringify({ text: result.text, runId: result.runId ?? null })}`,
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});

import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { buildWebSdkSessionId } from "@/lib/anorvis-gateway";
import {
  resolveAnorvisGatewayBaseUrl,
  resolveAnorvisGatewayToken,
} from "@/lib/anorvis-local-config";

export type RunAnorvisSdkAgentInput = {
  userId: string;
  threadId: string;
  agent: string;
  prompt: string;
  displayText?: string;
  piSessionId?: string;
  onRunStarted?: (runId: string) => void;
};

export type RunAnorvisSdkAgentResult = {
  text: string;
  runId: string | null;
};

const RESULT_PREFIX = "ANORVIS_SDK_RESULT ";
const RUN_STARTED_PREFIX = "ANORVIS_SDK_RUN_STARTED ";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function resolveRepoRoot(): string {
  return resolve(
    process.env.ANORVIS_REPO_ROOT?.trim() || join(process.cwd(), "..", ".."),
  );
}

function resolveBridgePath(): string {
  return join(process.cwd(), "src", "lib", "anorvis-sdk-bridge.mjs");
}

export async function runAnorvisSdkAgent(
  input: RunAnorvisSdkAgentInput,
): Promise<RunAnorvisSdkAgentResult> {
  const repoRoot = resolveRepoRoot();
  const bridgePath = resolveBridgePath();

  const payload = {
    agent: input.agent,
    prompt: input.prompt,
    displayText: input.displayText,
    sessionId:
      input.piSessionId ?? buildWebSdkSessionId(input.userId, input.threadId),
    piSessionId: input.piSessionId,
    repoRoot,
    cwd: repoRoot,
    osUrl: resolveAnorvisGatewayBaseUrl(),
    osToken: resolveAnorvisGatewayToken(),
  };

  return new Promise<RunAnorvisSdkAgentResult>((resolvePromise, reject) => {
    const child = spawn(process.env.BUN_BIN?.trim() || "bun", [bridgePath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PI_SKIP_VERSION_CHECK: process.env.PI_SKIP_VERSION_CHECK ?? "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let startedRunId: string | null = null;
    const timeout = setTimeout(
      () => {
        if (settled) return;
        settled = true;
        child.kill("SIGTERM");
        if (startedRunId) {
          void markRunFailed(
            payload.osUrl,
            payload.osToken,
            startedRunId,
            "SDK agent execution timed out.",
          );
        }
        reject(new Error("SDK agent execution timed out."));
      },
      Number(process.env.ANORVIS_WEB_AGENT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    );

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      for (const line of chunk.split("\n")) {
        if (!line.startsWith(RUN_STARTED_PREFIX)) continue;
        try {
          const parsed = JSON.parse(line.slice(RUN_STARTED_PREFIX.length)) as {
            runId?: unknown;
          };
          if (typeof parsed.runId === "string") {
            startedRunId = parsed.runId;
            input.onRunStarted?.(parsed.runId);
          }
        } catch {
          // Ignore malformed bridge progress markers; final result parsing will still validate output.
        }
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (startedRunId) {
        void markRunFailed(
          payload.osUrl,
          payload.osToken,
          startedRunId,
          error.message,
        );
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (code !== 0) {
        const message = `SDK agent execution failed: ${stderr.trim() || stdout.trim() || `exit code ${code}`}`;
        if (startedRunId) {
          void markRunFailed(
            payload.osUrl,
            payload.osToken,
            startedRunId,
            message,
          );
        }
        reject(new Error(message));
        return;
      }

      const resultLine = stdout
        .trim()
        .split("\n")
        .reverse()
        .find((line) => line.startsWith(RESULT_PREFIX));
      if (!resultLine) {
        reject(new Error("SDK agent execution returned no result marker."));
        return;
      }

      try {
        const parsed = JSON.parse(resultLine.slice(RESULT_PREFIX.length)) as {
          text?: unknown;
          runId?: unknown;
        };
        if (typeof parsed.text !== "string") {
          throw new Error("missing text");
        }
        resolvePromise({
          text: parsed.text,
          runId: typeof parsed.runId === "string" ? parsed.runId : null,
        });
      } catch (error) {
        reject(
          new Error(
            `SDK agent execution returned invalid result: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

async function markRunFailed(
  osUrl: string,
  osToken: string,
  runId: string,
  error: string,
): Promise<void> {
  await fetch(new URL(`/v1/runs/${encodeURIComponent(runId)}/fail`, osUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${osToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ error }),
  }).catch(() => undefined);
}

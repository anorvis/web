import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isRecord } from "@/lib/guards";

function piSessionPath(agent: string, piSessionId: string): string {
  return join(
    homedir(),
    ".anorvis",
    "agents",
    agent,
    "sessions",
    `${piSessionId}.jsonl`,
  );
}

function basePiSessionId(piSessionId: string): string {
  const marker = "-edit-";
  const index = piSessionId.indexOf(marker);
  return index === -1 ? piSessionId : piSessionId.slice(0, index);
}

function piMessageText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return null;
  return value
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      if (typeof entry.text === "string") return [entry.text];
      if (typeof entry.content === "string") return [entry.content];
      return [];
    })
    .join("\n")
    .trim();
}

function isEditedVisiblePrompt(input: {
  storedText: string | null;
  visibleText: string;
}): boolean {
  const storedText = input.storedText?.trim();
  const visibleText = input.visibleText.trim();
  if (!storedText || !visibleText) return false;
  return (
    storedText === visibleText ||
    storedText.endsWith(`\n\n${visibleText}`) ||
    storedText.endsWith(visibleText)
  );
}

function sessionPreamble(lines: string[]): string[] {
  const preamble: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (isRecord(parsed) && parsed.type === "message") break;
    } catch {
      break;
    }
    preamble.push(line);
  }
  return preamble;
}

export async function branchPiSession(input: {
  agent: string;
  fromPiSessionId: string;
  toPiSessionId: string;
  rewindContent: string;
}): Promise<void> {
  const sourcePath = piSessionPath(input.agent, input.fromPiSessionId);
  const baseSourcePath = piSessionPath(
    input.agent,
    basePiSessionId(input.fromPiSessionId),
  );
  const targetPath = piSessionPath(input.agent, input.toPiSessionId);
  await mkdir(dirname(targetPath), { recursive: true });
  try {
    const contents = await readFile(baseSourcePath, "utf8").catch(() =>
      readFile(sourcePath, "utf8"),
    );
    const lines = contents.split("\n");
    const kept: string[] = [];
    let foundRewindPoint = false;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as unknown;
        if (isRecord(parsed) && parsed.type === "message") {
          const message = parsed.message;
          if (isRecord(message) && message.role === "user") {
            if (
              isEditedVisiblePrompt({
                storedText: piMessageText(message.content),
                visibleText: input.rewindContent,
              })
            ) {
              foundRewindPoint = true;
              break;
            }
          }
        }
      } catch {
        // Keep malformed historical lines rather than corrupting the branch.
      }
      kept.push(line);
    }
    await writeFile(
      targetPath,
      `${(foundRewindPoint ? kept : sessionPreamble(lines)).join("\n")}\n`,
      "utf8",
    );
  } catch {
    await writeFile(targetPath, "", "utf8");
  }
}

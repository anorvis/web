import { devStyles } from "@anorvis/ui/styles";
import type { ReactNode } from "react";
import { isRecord } from "@/lib/guards";

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function renderInlineText(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part) => {
    const key = `${part}-${crypto.randomUUID()}`;
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className={devStyles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function FormattedText({ value }: { value: string }) {
  const blocks = value.split(
    /(<anorvis-toolkit>[\s\S]*?(?:<\/anorvis-toolkit>|$)|<context>[\s\S]*?(?:<\/context>|$)|```[\s\S]*?```)/g,
  );
  return (
    <div className={devStyles.formattedText}>
      {blocks.map((block) => {
        const blockKey = `${block.slice(0, 32)}-${crypto.randomUUID()}`;
        if (block.startsWith("<anorvis-toolkit>")) {
          return <ToolkitContextBlock key={blockKey} value={block} />;
        }
        if (block.startsWith("<context>")) {
          return <SystemContextBlock key={blockKey} value={block} />;
        }

        if (block.startsWith("```") && block.endsWith("```")) {
          const code = block
            .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
            .replace(/```$/, "");
          return <CodeBlock key={blockKey} value={code} />;
        }

        const parsed = tryParseJson(block.trim());
        if (parsed !== null && (isRecord(parsed) || Array.isArray(parsed))) {
          return <JsonBlock key={blockKey} value={parsed} />;
        }

        const lines = block.split("\n");
        const elements: ReactNode[] = [];
        let listItems: string[] = [];
        const flushList = () => {
          if (listItems.length === 0) return;
          const items = listItems;
          listItems = [];
          elements.push(
            <ul
              key={`list-${crypto.randomUUID()}`}
              className="ml-4 list-disc space-y-1"
            >
              {items.map((item) => (
                <li key={`${item}-${crypto.randomUUID()}`}>
                  {renderInlineText(item)}
                </li>
              ))}
            </ul>,
          );
        };

        for (const line of lines) {
          const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
          if (listMatch) {
            listItems.push(listMatch[1] ?? "");
            continue;
          }
          flushList();
          if (!line.trim()) {
            elements.push(
              <div key={`space-${elements.length}`} className="h-1" />,
            );
            continue;
          }
          elements.push(
            <p
              key={`${line}-${crypto.randomUUID()}`}
              className="whitespace-pre-wrap"
            >
              {renderInlineText(line)}
            </p>,
          );
        }
        flushList();
        return elements;
      })}
    </div>
  );
}

function SystemContextBlock({ value }: { value: string }) {
  const body = value
    .replace(/^<context>\s*/, "")
    .replace(/\s*<\/context>$/, "")
    .trim();
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const fields: Array<{ label: string; value: string }> = [];
  const directoryStart = lines.findIndex((line) =>
    line.toLowerCase().startsWith("directory structure"),
  );
  const detailLines =
    directoryStart >= 0 ? lines.slice(0, directoryStart) : lines;
  for (const line of detailLines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      fields.push({ label: match[1] ?? "", value: match[2] ?? "" });
    }
  }
  const directories =
    directoryStart >= 0
      ? lines.slice(directoryStart + 1).filter((line) => !line.endsWith(":"))
      : [];

  return (
    <div className={devStyles.contextBlock}>
      <div>
        <p className={devStyles.contextLabel}>system context</p>
        <p className="text-[0.7rem] text-foreground">
          runtime environment provided to the agent
        </p>
      </div>
      {fields.length > 0 && (
        <div className="grid gap-1">
          {fields.map((field) => (
            <div
              key={`${field.label}-${field.value}`}
              className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)]"
            >
              <span className={devStyles.tinyMeta}>{field.label}</span>
              <span className="break-words text-[0.65rem] text-foreground">
                {field.value}
              </span>
            </div>
          ))}
        </div>
      )}
      {directories.length > 0 && (
        <div className="space-y-1 border-t border-border/60 pt-2">
          <p className={devStyles.tinyMeta}>directory structure</p>
          <div className="flex flex-wrap gap-1.5">
            {directories.map((directory) => (
              <code key={directory} className={devStyles.codeToken}>
                {directory}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolkitContextBlock({ value }: { value: string }) {
  const body = value
    .replace(/^<anorvis-toolkit>\s*/, "")
    .replace(/\s*<\/anorvis-toolkit>$/, "")
    .trim();
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title =
    lines.find((line) => line.startsWith("## "))?.replace(/^##\s+/, "") ??
    "Anorvis toolkit context";
  const runId =
    lines
      .find((line) => line.includes("ANORVIS_RUN_ID="))
      ?.match(/ANORVIS_RUN_ID=([^\s]+)/)?.[1] ?? null;
  const commandLines = lines.filter((line) =>
    line.startsWith("anorvis tools "),
  );
  const sections = lines.reduce<Array<{ title: string; operations: string[] }>>(
    (acc, line) => {
      if (line.startsWith("### ")) {
        acc.push({ title: line.replace(/^###\s+/, ""), operations: [] });
        return acc;
      }
      if (line.startsWith("- ") && acc.length > 0) {
        acc[acc.length - 1]?.operations.push(line.replace(/^-\s+/, ""));
      }
      return acc;
    },
    [],
  );

  return (
    <div className={devStyles.toolkitBlock}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={devStyles.toolkitLabel}>context</p>
          <p className="text-[0.7rem] text-foreground">{title}</p>
        </div>
        {runId && <code className={devStyles.toolkitCode}>{runId}</code>}
      </div>

      {commandLines.length > 0 && (
        <div className="space-y-1">
          <p className={devStyles.tinyMeta}>commands</p>
          <div className="grid gap-1">
            {commandLines.map((command) => (
              <code key={command} className={devStyles.codeToken}>
                {command}
              </code>
            ))}
          </div>
        </div>
      )}

      {sections.map((section) => (
        <div
          key={section.title}
          className="space-y-2 border-t border-border/60 pt-2"
        >
          <p className="text-[0.62rem] font-medium text-foreground">
            {section.title}
          </p>
          <ul className="ml-4 list-disc space-y-1">
            {section.operations.map((operation) => (
              <li key={operation} className="text-[0.62rem]">
                {renderInlineText(operation)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function CodeBlock({ value }: { value: string }) {
  return (
    <pre className={devStyles.codeBlock}>
      <code>{value}</code>
    </pre>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return <CodeBlock value={JSON.stringify(value, null, 2)} />;
  }
  if (!isRecord(value)) {
    return <CodeBlock value={String(value)} />;
  }

  return (
    <div className={devStyles.jsonBlock}>
      {Object.entries(value).map(([key, entry]) => (
        <div key={key} className={devStyles.jsonRow}>
          <span className={devStyles.tinyMeta}>{key}</span>
          <span className="min-w-0 break-words text-[0.65rem] text-foreground">
            {typeof entry === "string" ||
            typeof entry === "number" ||
            typeof entry === "boolean" ||
            entry === null ? (
              String(entry)
            ) : (
              <CodeBlock value={JSON.stringify(entry, null, 2)} />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

type PiTranscriptEntry = {
  id: string;
  role: string;
  label: string;
  content: string;
  timestamp: string | null;
  isError: boolean;
};

function normalizeContextTags(value: string): string {
  return value
    .replace(/<context>\s*/g, "<context>\n")
    .replace(/\s*<\/context>/g, "\n</context>")
    .replace(/<anorvis-toolkit>\s*/g, "<anorvis-toolkit>\n")
    .replace(/\s*<\/anorvis-toolkit>/g, "\n</anorvis-toolkit>")
    .replace(/\s+(Date:)/g, "\n$1")
    .replace(/\s+(Working directory:)/g, "\n$1")
    .replace(/\s+(Directory structure:)/g, "\n$1")
    .replace(/(##\s+)/g, "\n$1")
    .replace(/(###\s+)/g, "\n$1")
    .replace(/\s+-\s+/g, "\n- ")
    .replace(/\s+(anorvis tools (?:list|describe|call))/g, "\n$1")
    .replace(/\s+(ANORVIS_RUN_ID=)/g, "\n$1")
    .trim();
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return normalizeContextTags(
    value
      .flatMap((entry) => {
        if (!isRecord(entry)) return [];
        if (typeof entry.text === "string") return [entry.text];
        if (typeof entry.content === "string") return [entry.content];
        return [];
      })
      .join("\n")
      .trim(),
  );
}

export function parsePiSessionTranscript(content: string): PiTranscriptEntry[] {
  return content
    .split("\n")
    .filter(Boolean)
    .flatMap((line, index) => {
      let value: unknown;
      try {
        value = JSON.parse(line) as unknown;
      } catch {
        return [];
      }

      if (!isRecord(value) || value.type !== "message") return [];
      const message = value.message;
      if (!isRecord(message)) return [];

      const role = typeof message.role === "string" ? message.role : "unknown";
      const isTool = role === "toolResult";
      const text = contentText(message.content);
      if (!text) return [];

      const toolName =
        typeof message.toolName === "string" ? message.toolName : "tool";

      return [
        {
          id:
            typeof value.id === "string"
              ? value.id
              : `${role}-${index.toString()}`,
          role,
          label: isTool ? toolName : role,
          content: text,
          timestamp:
            typeof value.timestamp === "string" ? value.timestamp : null,
          isError: message.isError === true,
        },
      ];
    });
}

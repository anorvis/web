import { chatStyles } from "@anorvis/ui/styles";
import { memo, type ReactNode } from "react";
import { formatTime, type GatewayMessage } from "@/features/chat/api/client";
import { isRecord } from "@/lib/guards";

type ChatRenderItem =
  | { type: "message"; id: string; message: GatewayMessage }
  | { type: "activityGroup"; id: string; messages: GatewayMessage[] };

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(
    /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g,
  );
  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-inline-${index.toString()}`;
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className={chatStyles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isSafeHref = /^(https?:|mailto:)/i.test(href ?? "");
      if (isSafeHref) {
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {label}
          </a>
        );
      }
      return label;
    }
    return part;
  });
}

function isTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function MessageContentComponent({ content }: { content: string }) {
  const blocks = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className={chatStyles.markdown}>
      {blocks.map((block, blockIndex) => {
        const blockKey = `block-${blockIndex.toString()}`;
        if (block.startsWith("```") && block.endsWith("```")) {
          const code = block
            .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
            .replace(/```$/, "");
          return (
            <pre key={blockKey} className={chatStyles.codeBlock}>
              <code>{code}</code>
            </pre>
          );
        }

        const lines = block.split("\n");
        const elements: ReactNode[] = [];
        let listItems: Array<{ text: string; ordered: boolean }> = [];
        let tableRows: string[][] = [];
        const flushList = () => {
          if (listItems.length === 0) return;
          const items = listItems;
          listItems = [];
          const ListTag = items[0]?.ordered ? "ol" : "ul";
          elements.push(
            <ListTag
              key={`${blockKey}-list-${elements.length.toString()}`}
              className={`ml-4 space-y-1 ${items[0]?.ordered ? "list-decimal" : "list-disc"}`}
            >
              {items.map((item, itemIndex) => (
                <li key={`${blockKey}-item-${itemIndex.toString()}`}>
                  {renderInlineMarkdown(
                    item.text,
                    `${blockKey}-item-${itemIndex.toString()}`,
                  )}
                </li>
              ))}
            </ListTag>,
          );
        };
        const flushTable = () => {
          if (tableRows.length === 0) return;
          const rows = tableRows;
          tableRows = [];
          const [headers, ...bodyRows] = rows;
          if (!headers) return;
          elements.push(
            <div
              key={`${blockKey}-table-${elements.length.toString()}`}
              className={chatStyles.tableWrapper}
            >
              <table className={chatStyles.table}>
                <thead>
                  <tr>
                    {headers.map((header, headerIndex) => (
                      <th
                        key={`${blockKey}-table-head-${headerIndex.toString()}`}
                        className={chatStyles.tableHead}
                      >
                        {renderInlineMarkdown(
                          header,
                          `${blockKey}-table-head-${headerIndex.toString()}`,
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rowIndex) => (
                    <tr key={`${blockKey}-table-row-${rowIndex.toString()}`}>
                      {headers.map((_, cellIndex) => (
                        <td
                          key={`${blockKey}-table-cell-${rowIndex.toString()}-${cellIndex.toString()}`}
                          className={chatStyles.tableCell}
                        >
                          {renderInlineMarkdown(
                            row[cellIndex] ?? "",
                            `${blockKey}-table-cell-${rowIndex.toString()}-${cellIndex.toString()}`,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>,
          );
        };

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = lines[lineIndex] ?? "";
          const nextLine = lines[lineIndex + 1] ?? "";
          if (
            line.includes("|") &&
            isTableDivider(nextLine) &&
            lines[lineIndex + 2]?.includes("|")
          ) {
            flushList();
            flushTable();
            tableRows.push(parseTableCells(line));
            lineIndex += 2;
            while (lineIndex < lines.length) {
              const rowLine = lines[lineIndex] ?? "";
              if (!rowLine.includes("|") || isTableDivider(rowLine)) break;
              tableRows.push(parseTableCells(rowLine));
              lineIndex += 1;
            }
            lineIndex -= 1;
            flushTable();
            continue;
          }
          const listMatch = line.match(/^\s*([-*]|\d+[.)])\s+(.+)$/);
          if (listMatch) {
            flushTable();
            const ordered = /^\d/.test(listMatch[1] ?? "");
            if (listItems.length > 0 && listItems[0]?.ordered !== ordered) {
              flushList();
            }
            listItems.push({ text: listMatch[2] ?? "", ordered });
            continue;
          }
          flushList();
          flushTable();
          if (!line.trim()) {
            elements.push(
              <div key={`space-${elements.length}`} className="h-1" />,
            );
            continue;
          }
          if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
            elements.push(
              <hr
                key={`${blockKey}-rule-${elements.length.toString()}`}
                className="border-border"
              />,
            );
            continue;
          }
          const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
          if (headingMatch) {
            const level = headingMatch[1]?.length ?? 1;
            const HeadingTag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
            elements.push(
              <HeadingTag
                key={`${blockKey}-heading-${elements.length.toString()}`}
                className={
                  level === 1
                    ? "text-[0.8rem] font-semibold tracking-tight"
                    : level === 2
                      ? "text-[0.72rem] font-semibold tracking-tight"
                      : "font-semibold tracking-tight"
                }
              >
                {renderInlineMarkdown(
                  headingMatch[2] ?? "",
                  `${blockKey}-heading-${elements.length.toString()}`,
                )}
              </HeadingTag>,
            );
            continue;
          }
          const quoteMatch = line.match(/^>\s?(.+)$/);
          if (quoteMatch) {
            elements.push(
              <blockquote
                key={`${blockKey}-quote-${elements.length.toString()}`}
                className={chatStyles.quote}
              >
                {renderInlineMarkdown(
                  quoteMatch[1] ?? "",
                  `${blockKey}-quote-${elements.length.toString()}`,
                )}
              </blockquote>,
            );
            continue;
          }
          elements.push(
            <p
              key={`${blockKey}-line-${elements.length.toString()}`}
              className="whitespace-pre-wrap"
            >
              {renderInlineMarkdown(
                line,
                `${blockKey}-line-${elements.length.toString()}`,
              )}
            </p>,
          );
        }
        flushList();
        return elements;
      })}
    </div>
  );
}

export const MessageContent = memo(MessageContentComponent);

function activityLabel(content: string): string {
  const firstLine = content.split("\n", 1)[0] ?? "";
  const call = firstLine.match(/^Tool call:\s*(.+)$/i)?.[1]?.trim();
  const result = firstLine.match(/^Tool result:\s*(.+)$/i)?.[1]?.trim();
  if (call) return call;
  if (result) return `Result: ${result}`;
  return "Agent activity";
}

function fieldAsString(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function parseLiveTranscript(input: {
  runId: string;
  content: string;
}): GatewayMessage[] {
  const toolNamesById = new Map<string, string>();
  const messages: GatewayMessage[] = [];

  for (const [index, line] of input.content
    .split("\n")
    .filter(Boolean)
    .entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      continue;
    }
    if (!isRecord(parsed) || parsed.type !== "message") continue;
    const rawMessage = parsed.message;
    if (!isRecord(rawMessage)) continue;
    const role =
      typeof rawMessage.role === "string" ? rawMessage.role : "unknown";
    const content = rawMessage.content;
    if (Array.isArray(content)) {
      for (const entry of content) {
        if (!isRecord(entry) || entry.type !== "toolCall") continue;
        const toolUseId =
          fieldAsString(entry, "toolUseId") ??
          fieldAsString(entry, "toolCallId") ??
          fieldAsString(entry, "id");
        const name =
          fieldAsString(entry, "toolName") ??
          fieldAsString(entry, "name") ??
          fieldAsString(entry, "tool") ??
          "tool";
        if (toolUseId) toolNamesById.set(toolUseId, name);
        messages.push({
          id: `live-transcript-${input.runId}-${index.toString()}-${messages.length.toString()}`,
          sender: "tool",
          displayName: "Thinking",
          content: [
            `Tool call: ${name}`,
            "```json",
            compactJson(entry),
            "```",
          ].join("\n"),
          createdAt:
            fieldAsString(parsed, "timestamp") ?? new Date().toISOString(),
        });
      }
    }

    if (role !== "toolResult") continue;
    const toolUseId =
      fieldAsString(rawMessage, "toolUseId") ??
      fieldAsString(rawMessage, "toolCallId") ??
      fieldAsString(rawMessage, "id");
    const toolName = toolUseId
      ? (toolNamesById.get(toolUseId) ?? "tool")
      : "tool";
    const resultText =
      typeof content === "string" ? content : compactJson(rawMessage);
    messages.push({
      id: `live-transcript-${input.runId}-${index.toString()}-${messages.length.toString()}`,
      sender: "tool",
      displayName: "Thinking",
      content: `Tool result: ${toolName}\n${resultText}`,
      createdAt: fieldAsString(parsed, "timestamp") ?? new Date().toISOString(),
    });
  }

  return messages;
}

function ActivityMessageComponent({
  message,
  defaultOpen = false,
}: {
  message: GatewayMessage;
  defaultOpen?: boolean;
}) {
  const label = activityLabel(message.content);
  return (
    <details open={defaultOpen} className={chatStyles.activity}>
      <summary className={chatStyles.activitySummary}>
        <span className="text-blue-700 dark:text-blue-200">{label}</span>
        <span className={chatStyles.activityMeta}>
          {formatTime(message.createdAt)}
          <span className="group-open:hidden"> · expand</span>
          <span className="hidden group-open:inline"> · collapse</span>
        </span>
      </summary>
      <div className={chatStyles.activityBody}>
        <MessageContent content={message.content} />
      </div>
    </details>
  );
}

export const ActivityMessage = memo(ActivityMessageComponent);

function ActivityGroupComponent({
  messages,
  live = false,
}: {
  messages: GatewayMessage[];
  live?: boolean;
}) {
  const firstMessage = messages[0];
  const lastMessage = messages.at(-1);
  if (!firstMessage || !lastMessage) return null;

  return (
    <details open={live} className={chatStyles.activityGroup}>
      <summary className={chatStyles.activitySummary}>
        <span>
          {live ? "Agent activity live" : "Agent activity"} ({messages.length})
        </span>
        <span className={chatStyles.activityMeta}>
          {formatTime(firstMessage.createdAt)}
          {lastMessage.createdAt !== firstMessage.createdAt
            ? `–${formatTime(lastMessage.createdAt)}`
            : ""}
          <span className="group-open:hidden"> · expand</span>
          <span className="hidden group-open:inline"> · collapse</span>
        </span>
      </summary>
      <div className={chatStyles.activityGroupBody}>
        {messages.map((message) => (
          <ActivityMessage
            key={message.id}
            message={message}
            defaultOpen={live}
          />
        ))}
      </div>
    </details>
  );
}

export const ActivityGroup = memo(ActivityGroupComponent);

export function groupChatMessages(
  messages: GatewayMessage[],
): ChatRenderItem[] {
  const items: ChatRenderItem[] = [];
  let activityMessages: GatewayMessage[] = [];

  const flushActivityMessages = () => {
    if (activityMessages.length === 0) return;
    items.push({
      type: "activityGroup",
      id: `activity-${activityMessages.map((message) => message.id).join("-")}`,
      messages: activityMessages,
    });
    activityMessages = [];
  };

  for (const [index, message] of messages.entries()) {
    if (message.sender === "tool") {
      activityMessages.push(message);
      continue;
    }
    flushActivityMessages();
    items.push({
      type: "message",
      id: `message-${index}-${message.id}`,
      message,
    });
  }
  flushActivityMessages();

  return items;
}

"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@anorvis/ui/dropdown-menu";

import { workspacePageStyles } from "@anorvis/ui/styles";

type TagSelectProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  label?: string;
  options?: string[];
};

function normalizeOption(value: string) {
  return value.trim();
}

export function TagSelect({
  value,
  onChange,
  readOnly = false,
  label = "tag",
  options = [],
}: TagSelectProps) {
  const selected = normalizeOption(value);
  const selectOptions = Array.from(
    new Set([...options, selected].filter((tag): tag is string => !!tag)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className={workspacePageStyles.formLabel}>
      <span className={workspacePageStyles.metricLabel}>{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={readOnly}>
          <button
            type="button"
            className={`flex w-full items-center justify-between gap-2 ${workspacePageStyles.inlineInput}`}
          >
            <span className="truncate">{selected || "no tag"}</span>
            <span className="text-[0.55rem] text-muted-foreground">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={`z-[100] w-[var(--radix-dropdown-menu-trigger-width)] ${workspacePageStyles.dropdownContent}`}
        >
          <DropdownMenuRadioGroup value={selected} onValueChange={onChange}>
            <DropdownMenuRadioItem
              value=""
              className={workspacePageStyles.dropdownItem}
            >
              no tag
            </DropdownMenuRadioItem>
            {selectOptions.map((tag) => (
              <DropdownMenuRadioItem
                key={tag}
                value={tag}
                className={workspacePageStyles.dropdownItem}
              >
                <span className="min-w-0 truncate">{tag}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

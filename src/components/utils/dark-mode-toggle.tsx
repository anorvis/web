"use client";

import { Button } from "@anorvis/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anorvis/ui/dropdown-menu";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

export function ModeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useMountEffect(() => {
    setMounted(true);
  });

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn(workspacePageStyles.themeButton, className)}
        disabled
        aria-label="Toggle theme"
      >
        <Sun className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(workspacePageStyles.themeButton, className)}
        >
          <Sun className={workspacePageStyles.themeSun} />
          <Moon className={workspacePageStyles.themeMoon} />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={workspacePageStyles.dropdownContent}
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={workspacePageStyles.dropdownAction}
        >
          light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={workspacePageStyles.dropdownAction}
        >
          dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={workspacePageStyles.dropdownAction}
        >
          system
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

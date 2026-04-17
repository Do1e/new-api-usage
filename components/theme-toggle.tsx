"use client";

import * as React from "react";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return null;
  }

  const getIndicatorPosition = () => {
    switch (theme) {
      case "light":
        return "translate-x-0";
      case "system":
        return "translate-x-[calc(100%)]";
      case "dark":
        return "translate-x-[calc(200%)]";
      default:
        return "translate-x-0";
    }
  };

  return (
    <div className="relative inline-flex rounded-full border border-zinc-200 p-0.75 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900">
      <div
        className={`absolute left-0.75 top-0.75 h-8 w-8 rounded-full bg-white dark:bg-zinc-700 shadow-md transition-transform duration-200 ease-in-out ${getIndicatorPosition()}`}
      />

      <button
        aria-label="切换到亮色主题"
        type="button"
        onClick={() => setTheme("light")}
        className={`relative z-10 rounded-full inline-flex h-8 w-8 items-center justify-center border-0 transition-colors ${
          theme === "light"
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        aria-label="切换到系统主题"
        onClick={() => setTheme("system")}
        className={`relative z-10 rounded-full inline-flex h-8 w-8 items-center justify-center border-0 transition-colors ${
          theme === "system"
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`}
        type="button"
      >
        <Monitor className="h-4 w-4" />
      </button>
      <button
        aria-label="切换到暗色主题"
        onClick={() => setTheme("dark")}
        className={`relative z-10 rounded-full inline-flex h-8 w-8 items-center justify-center border-0 transition-colors ${
          theme === "dark"
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
        }`}
        type="button"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
};

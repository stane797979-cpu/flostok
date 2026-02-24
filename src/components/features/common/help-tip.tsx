"use client";

import { type ReactNode, useState, useEffect } from "react";
import { Info, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
}

export function HelpTip({
  title,
  children,
  defaultOpen = false,
  storageKey,
}: HelpTipProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // localStorage에서 저장된 상태 불러오기
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(`help-tip:${storageKey}`);
      if (stored !== null) {
        setIsOpen(stored === "true");
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, [storageKey]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (storageKey) {
      try {
        localStorage.setItem(`help-tip:${storageKey}`, String(open));
      } catch {
        // localStorage 접근 실패 시 무시
      }
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <div
        className={cn(
          "rounded-lg border p-3",
          "bg-blue-50 border-blue-200",
          "dark:bg-blue-950 dark:border-blue-800"
        )}
      >
        {/* 헤더: 아이콘 + 제목 + 토글 화살표 */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2",
              "text-left",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            )}
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {title}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400",
                "transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        {/* 접이식 내용 */}
        <CollapsibleContent>
          <div
            className={cn(
              "mt-2 pt-2",
              "border-t border-blue-200 dark:border-blue-800",
              "text-sm text-blue-700 dark:text-blue-300",
              "[&_p]:leading-relaxed [&_p+p]:mt-1.5",
              "[&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1",
              "[&_ol]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-1"
            )}
          >
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

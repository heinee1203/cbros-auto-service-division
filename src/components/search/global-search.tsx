"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Car, Users, Wrench, ClipboardList, Receipt, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "vehicle" | "customer" | "job_order" | "estimate" | "invoice";
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_ICONS = {
  vehicle: Car,
  customer: Users,
  job_order: Wrench,
  estimate: ClipboardList,
  invoice: Receipt,
} as const;

const TYPE_LABELS = {
  vehicle: "Vehicle",
  customer: "Customer",
  job_order: "Job Order",
  estimate: "Estimate",
  invoice: "Invoice",
} as const;

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Search as user types (debounced)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
          setSelectedIndex(0);
        }
      } catch {
        // silently fail — search is best-effort
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      router.push(result.href);
      onOpenChange(false);
      setQuery("");
    },
    [router, onOpenChange]
  );

  // Arrow key navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, handleSelect]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Search dialog */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
        <div className="bg-white rounded-xl shadow-2xl border border-surface-200 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center px-4 border-b border-surface-200">
            <Search className="w-5 h-5 text-surface-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plates, jobs, customers..."
              className="flex-1 px-3 py-4 text-sm bg-transparent outline-none placeholder:text-surface-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-2 rounded hover:bg-surface-100"
              >
                <X className="w-4 h-4 text-surface-400" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-4 py-8 text-center text-sm text-surface-400">
                Searching...
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-surface-400">
                No results found for &quot;{query}&quot;
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="py-2">
                {results.map((result, index) => {
                  const Icon = TYPE_ICONS[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-3 min-h-touch text-left text-sm transition-colors",
                        index === selectedIndex
                          ? "bg-accent-50 text-primary"
                          : "hover:bg-surface-50"
                      )}
                    >
                      <Icon className="w-4 h-4 text-surface-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        <p className="text-xs text-surface-400 truncate">
                          {result.subtitle}
                        </p>
                      </div>
                      <span className="text-[10px] font-medium text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[result.type]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {!query && (
              <div className="px-4 py-8 text-center text-sm text-surface-400">
                Type a plate number, customer name, or document number...
              </div>
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-surface-200 text-[10px] text-surface-400">
            <span>
              <kbd className="px-1 py-0.5 bg-surface-100 rounded font-mono">
                ↑↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface-100 rounded font-mono">
                ↵
              </kbd>{" "}
              select
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface-100 rounded font-mono">
                esc
              </kbd>{" "}
              close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

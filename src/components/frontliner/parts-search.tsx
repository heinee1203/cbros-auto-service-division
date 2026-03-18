"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";

interface PartsSearchProps {
  onSelect: (part: {
    description: string;
    pricePesos: number;
    apexProductId: string;
    apexSku: string;
  }) => void;
  onManualEntry: () => void;
  disabled?: boolean;
}

export function PartsSearch({ onSelect, onManualEntry, disabled }: PartsSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/parts/search?q=${encodeURIComponent(query)}&limit=15`);
        const data = await res.json();
        if (data.error === "catalog_disabled") {
          setError("Parts catalog not enabled");
          setResults([]);
        } else if (data.error === "catalog_offline") {
          setError("Parts catalog offline");
          setResults([]);
        } else {
          setResults(data.results || []);
          setIsOpen(true);
        }
      } catch {
        setError("Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--sch-text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search parts... (name, SKU, or OEM #)"
          disabled={disabled}
          className="w-full h-12 pl-10 pr-4 rounded-xl text-sm bg-[var(--sch-bg)] text-[var(--sch-text)] border border-[var(--sch-border)] placeholder:text-[var(--sch-text-muted)] focus:outline-none focus:border-[var(--sch-accent)]"
          onFocus={() => results.length > 0 && setIsOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--sch-text-muted)]" />
        )}
      </div>

      {/* Error state */}
      {error && (
        <p className="text-xs text-red-400 mt-1 px-1">
          {error}.{" "}
          <button onClick={onManualEntry} className="underline text-[var(--sch-accent)]">
            Enter manually
          </button>
        </p>
      )}

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-xl"
          style={{ background: "var(--sch-surface)", borderColor: "var(--sch-border)" }}
        >
          {results.map((part) => {
            const stockTotal = part.stock?.total ?? 0;
            const stockColor = stockTotal > 5 ? "#34D399" : stockTotal > 0 ? "#FBBF24" : "#F87171";
            const stockIcon = stockTotal > 5 ? "\u2713" : stockTotal > 0 ? "\u26A0" : "\u2715";

            return (
              <button
                key={part.id}
                type="button"
                onClick={() => {
                  onSelect({
                    description: `${part.brand} ${part.name}`.trim(),
                    pricePesos: part.sell_price,
                    apexProductId: part.id,
                    apexSku: part.sku,
                  });
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-[var(--sch-bg)] transition-colors border-b border-[var(--sch-border)] last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--sch-text)] truncate">
                      {part.brand} {part.name}
                    </p>
                    <p className="text-xs text-[var(--sch-text-muted)] mt-0.5">
                      SKU: {part.sku}
                      {part.oem_number && <> &middot; OEM: {part.oem_number}</>}
                    </p>
                    <p className="text-xs text-[var(--sch-text-muted)]">
                      {part.category}
                      {part.brand && <> &middot; {part.brand}</>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-semibold text-[var(--sch-accent)]">
                      &#8369;{part.sell_price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: stockColor }}>
                      {stockIcon} Stock: {stockTotal}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Manual entry fallback */}
          <button
            type="button"
            onClick={onManualEntry}
            className="w-full text-left px-4 py-3 text-sm text-[var(--sch-text-muted)] hover:bg-[var(--sch-bg)]"
          >
            Can&apos;t find it?{" "}
            <span className="underline text-[var(--sch-accent)]">Enter manually</span>
          </button>
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && !loading && results.length === 0 && !error && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl border p-4 text-center"
          style={{ background: "var(--sch-surface)", borderColor: "var(--sch-border)" }}
        >
          <p className="text-sm text-[var(--sch-text-muted)]">
            No parts found for &ldquo;{query}&rdquo;.{" "}
            <button onClick={onManualEntry} className="underline text-[var(--sch-accent)]">
              Enter manually
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

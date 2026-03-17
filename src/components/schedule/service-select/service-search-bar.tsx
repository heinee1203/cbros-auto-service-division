"use client";

import { useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

interface ServiceSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function ServiceSearchBar({ value, onChange }: ServiceSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
        style={{ color: "var(--sch-text-dim)" }}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='Search services… e.g. "brake pad", "oil change"'
        className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm outline-none transition-colors"
        style={{
          background: "var(--sch-input-bg)",
          border: "1px solid var(--sch-input-border)",
          color: "var(--sch-text)",
        }}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-colors"
          style={{ color: "var(--sch-text-muted)" }}
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

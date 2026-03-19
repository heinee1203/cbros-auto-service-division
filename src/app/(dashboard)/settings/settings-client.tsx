"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  Building2,
  DollarSign,
  Receipt,
  Camera,
  FileText,
  Shield,
  Hash,
  Bell,
  Heart,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  Save,
  Plus,
  X,
  Loader2,
  Plug,
  MessageSquare,
} from "lucide-react";
import { updateSettingsBatchAction } from "@/lib/actions/settings-actions";

type SettingItem = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string;
};

type GroupedSettings = Record<string, SettingItem[]>;

const CATEGORY_CONFIG: Array<{
  key: string;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "shop_profile", label: "Shop Profile", icon: Building2 },
  { key: "labor", label: "Labor & Pricing", icon: DollarSign },
  { key: "tax", label: "Tax", icon: Receipt },
  { key: "photos", label: "Photo Requirements", icon: Camera },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "warranty", label: "Warranty", icon: Shield },
  { key: "numbering", label: "Numbering", icon: Hash },
  { key: "followup", label: "Follow-Up", icon: Bell },
  { key: "care_instructions", label: "Care Instructions", icon: Heart },
  { key: "qc", label: "QC Checklists", icon: ClipboardCheck },
  { key: "session", label: "Session", icon: Clock },
  { key: "alerts", label: "Alerts", icon: AlertTriangle },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "sms", label: "SMS", icon: MessageSquare },
];

function formatLabel(key: string): string {
  return key
    .replace(/^(shop_|default_|next_|care_instructions_|qc_checklist_|followup_|photo_|warranty_|session_timeout_|hour_overrun_|parts_)/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getFieldType(
  key: string,
  category: string
): "boolean" | "centavos" | "percentage" | "months" | "number" | "textarea" | "json_array" | "password" | "text" {
  if (key.endsWith("_enabled")) return "boolean";
  if (key.includes("_api_key") || key.includes("_secret") || key.includes("_token")) return "password";
  if (category === "qc") return "json_array";
  if (category === "documents" || category === "care_instructions") return "textarea";
  if (category === "labor" && key.includes("_rate")) return "centavos";
  if (
    key.includes("_pct") ||
    key.includes("_markup") ||
    key.includes("_multiplier") ||
    key === "vat_rate"
  )
    return "percentage";
  if (key.includes("_months") || key.includes("_duration")) return "months";
  if (
    key.includes("_min_") ||
    key.includes("_max_") ||
    key.includes("_hours") ||
    key.includes("_sequence")
  )
    return "number";
  return "text";
}

function BooleanToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? "bg-accent" : "bg-surface-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function JsonArrayEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const addItem = () => onChange([...items, ""]);
  const removeItem = (index: number) =>
    onChange(items.filter((_, i) => i !== index));
  const updateItem = (index: number, value: string) =>
    onChange(items.map((item, i) => (i === index ? value : item)));

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Checklist item..."
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="rounded p-1 text-surface-400 hover:bg-red-50 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-surface-300 px-3 py-1.5 text-sm text-surface-500 hover:border-accent hover:text-accent"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Item
      </button>
    </div>
  );
}

function SettingField({
  setting,
  value,
  onChange,
}: {
  setting: SettingItem;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldType = getFieldType(setting.key, setting.category);
  const label = setting.description || formatLabel(setting.key);

  const renderField = () => {
    switch (fieldType) {
      case "boolean": {
        let boolVal = false;
        try {
          boolVal = JSON.parse(value);
        } catch {
          boolVal = false;
        }
        return (
          <BooleanToggle
            value={boolVal}
            onChange={(val) => onChange(JSON.stringify(val))}
          />
        );
      }

      case "centavos": {
        const centavos = parseInt(value, 10) || 0;
        const pesos = centavos / 100;
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">
              ₱
            </span>
            <input
              type="number"
              step="0.01"
              value={pesos}
              onChange={(e) => {
                const val = Math.round(parseFloat(e.target.value || "0") * 100);
                onChange(String(val));
              }}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 py-2 pl-8 pr-3 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        );
      }

      case "percentage": {
        return (
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 pr-8 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">
              {setting.key.includes("_multiplier") ? "x" : "%"}
            </span>
          </div>
        );
      }

      case "months": {
        return (
          <div className="relative">
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 pr-20 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">
              months
            </span>
          </div>
        );
      }

      case "number": {
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        );
      }

      case "textarea": {
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        );
      }

      case "json_array": {
        let items: string[] = [];
        try {
          items = JSON.parse(value);
          if (!Array.isArray(items)) items = [];
        } catch {
          items = [];
        }
        return (
          <JsonArrayEditor
            items={items}
            onChange={(arr) => onChange(JSON.stringify(arr))}
          />
        );
      }

      case "password": {
        return (
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm font-mono text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        );
      }

      default: {
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        );
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-primary">{label}</label>
      {renderField()}
    </div>
  );
}

export function SettingsClient({
  initialSettings,
}: {
  initialSettings: GroupedSettings;
}) {
  const [activeCategory, setActiveCategory] = useState(
    CATEGORY_CONFIG[0]?.key || "shop_profile"
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const items of Object.values(initialSettings)) {
      for (const s of items) {
        map[s.key] = s.value;
      }
    }
    return map;
  });
  const [originalValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const items of Object.values(initialSettings)) {
      for (const s of items) {
        map[s.key] = s.value;
      }
    }
    return map;
  });
  const [isPending, startTransition] = useTransition();
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    productCount?: number;
    error?: string;
  } | null>(null);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = () => {
    const categorySettings = initialSettings[activeCategory] || [];
    const updates = categorySettings
      .filter((s) => values[s.key] !== originalValues[s.key])
      .map((s) => ({ key: s.key, value: values[s.key] }));

    if (updates.length === 0) {
      toast.info("No changes to save");
      return;
    }

    startTransition(async () => {
      const result = await updateSettingsBatchAction(updates);
      if (result.success) {
        toast.success("Settings saved successfully");
        // Update original values to reflect saved state
        for (const u of updates) {
          originalValues[u.key] = u.value;
        }
      } else {
        toast.error(result.error || "Failed to save settings");
      }
    });
  };

  const activeCategorySettings = initialSettings[activeCategory] || [];
  const activeCategoryConfig = CATEGORY_CONFIG.find(
    (c) => c.key === activeCategory
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="mt-1 text-sm text-surface-400">
          Manage shop configuration and preferences
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar — horizontal scroll on mobile, vertical on desktop */}
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:w-56 lg:flex-shrink-0 lg:flex-col lg:overflow-x-visible lg:pb-0">
          {CATEGORY_CONFIG.filter((c) => initialSettings[c.key]).map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-surface-500 hover:bg-surface-100 hover:text-primary"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1">
          <div className="rounded-xl border border-surface-200 bg-white p-6">
            <h2 className="mb-6 text-lg font-semibold text-primary">
              {activeCategoryConfig?.label || activeCategory}
            </h2>

            <div className="space-y-5">
              {activeCategorySettings.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  value={values[setting.key] ?? setting.value}
                  onChange={(val) => handleChange(setting.key, val)}
                />
              ))}
            </div>

            {activeCategory === "integrations" && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={async () => {
                    setTestingConnection(true);
                    setConnectionResult(null);
                    try {
                      const res = await fetch("/api/parts/test-connection", {
                        method: "POST",
                      });
                      const data = await res.json();
                      setConnectionResult(data);
                    } catch {
                      setConnectionResult({
                        success: false,
                        error: "Network error",
                      });
                    } finally {
                      setTestingConnection(false);
                    }
                  }}
                  disabled={testingConnection}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Plug className="h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </button>
                {connectionResult && (
                  <span
                    className={`text-sm ${
                      connectionResult.success
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {connectionResult.success
                      ? `Connected (${connectionResult.productCount?.toLocaleString() || "?"} products)`
                      : connectionResult.error || "Disconnected"}
                  </span>
                )}
              </div>
            )}

            <div className="mt-8 flex justify-end border-t border-surface-100 pt-4">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

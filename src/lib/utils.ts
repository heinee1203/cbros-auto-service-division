import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class merge utility (shadcn/ui standard)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format centavos to Philippine Peso display string
// 123456 → "₱1,234.56"
export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  return `₱${pesos.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Format centavos to number string without currency symbol (for inputs)
// 123456 → "1234.56"
export function centavosToPesos(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

// Parse peso input string to centavos
// "1234.56" → 123456
export function pesosToCentavos(pesos: string | number): number {
  const num = typeof pesos === "string" ? parseFloat(pesos) : pesos;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

// Format date for display — "Mar 14, 2026"
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

// Format date + time for display — "Mar 14, 2026 2:30 PM"
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

// Format time only — "2:30 PM"
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

// Generate document numbers: EST-YYYYMMDD-XXXX, JO-YYYYMMDD-XXXX, etc.
export function generateDocNumber(
  prefix: string,
  sequence: number,
  date?: Date
): string {
  const d = date ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `${prefix}-${yyyy}${mm}${dd}-${seq}`;
}

// Get initials from name — "John Doe" → "JD"
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

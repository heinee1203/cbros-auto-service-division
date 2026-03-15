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

// Format Philippine phone number for display
// "09171234567" → "0917 123 4567"
// "+639171234567" → "+63 917 123 4567"
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return `+63 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone; // return as-is if format doesn't match
}

// Validate Philippine phone number
export function isValidPhPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // 09XX XXXX XXX (11 digits starting with 09)
  if (digits.startsWith("09") && digits.length === 11) return true;
  // +63 9XX XXXX XXX (12 digits starting with 639)
  if (digits.startsWith("639") && digits.length === 12) return true;
  return false;
}

// Validate Philippine plate number
// Standard: ABC 1234 or ABC-1234 (3 letters + 4 digits)
// Newer format allows mixed letter/digit sequences
export function isValidPlateNumber(plate: string): boolean {
  const cleaned = plate.replace(/[\s-]/g, "").toUpperCase();
  if (cleaned.length < 6 || cleaned.length > 8) return false;
  // Standard format: 3 letters + 4 digits
  if (/^[A-Z]{3}\d{4}$/.test(cleaned)) return true;
  // Newer format: mixed alphanumeric, 6-7 chars
  if (/^[A-Z0-9]{6,7}$/.test(cleaned)) return true;
  return false;
}

// Format plate number for display: "ABC1234" → "ABC 1234"
export function formatPlateNumber(plate: string): string {
  const cleaned = plate.replace(/[\s-]/g, "").toUpperCase();
  // Standard format: split after 3 letters
  if (/^[A-Z]{3}\d{4}$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  return cleaned;
}

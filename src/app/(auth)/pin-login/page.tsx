"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import Link from "next/link";
import { Delete } from "lucide-react";

export default function PinLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const maxLength = 6;

  function handleDigit(digit: string) {
    if (pin.length >= maxLength) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError("");

    // Auto-submit when 4+ digits and user pauses
    if (newPin.length >= 4) {
      // Give a brief moment for 5-6 digit PINs
      setTimeout(() => {
        // Only submit if pin hasn't changed (user stopped typing)
      }, 500);
    }
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
    setError("");
  }

  function handleClear() {
    setPin("");
    setError("");
  }

  async function handleSubmit() {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    setError("");
    setLoading(true);

    const result = await signIn("pin", {
      pin,
      redirect: false,
      callbackUrl: "/",
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid PIN");
      setPin("");
    } else if (result?.url) {
      router.push(result.url);
    }
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="w-full max-w-xs">
      {/* Logo */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-3">
          <span className="font-mono font-bold text-primary text-xl">AS</span>
        </div>
        <h1 className="text-xl font-bold text-white">PIN Login</h1>
        <p className="text-xs text-white/50 mt-1">Enter your 4-6 digit PIN</p>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-2xl">
        {/* PIN display */}
        <div className="flex justify-center gap-2 mb-5">
          {Array.from({ length: maxLength }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i < pin.length ? "bg-accent" : "bg-surface-200"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-danger font-medium text-center mb-3">
            {error}
          </p>
        )}

        {/* Number pad — large touch targets for glove-friendly use */}
        <div className="grid grid-cols-3 gap-2">
          {digits.map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              disabled={loading}
              className="h-14 rounded-lg bg-surface-50 hover:bg-surface-100 active:bg-surface-200 text-xl font-semibold text-primary transition-colors touch-target"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={loading}
            className="h-14 rounded-lg bg-surface-50 hover:bg-surface-100 text-xs font-medium text-surface-400 transition-colors touch-target"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigit("0")}
            disabled={loading}
            className="h-14 rounded-lg bg-surface-50 hover:bg-surface-100 active:bg-surface-200 text-xl font-semibold text-primary transition-colors touch-target"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading}
            className="h-14 rounded-lg bg-surface-50 hover:bg-surface-100 flex items-center justify-center text-surface-400 transition-colors touch-target"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4}
          className="w-full mt-4 py-3 bg-accent hover:bg-accent-500 text-primary font-semibold rounded-lg transition-colors disabled:opacity-50 touch-target"
        >
          {loading ? "Verifying..." : "Clock In"}
        </button>

        <div className="text-center mt-3">
          <Link
            href="/login"
            className="text-xs text-accent-600 hover:text-accent-700 font-medium"
          >
            Use Username & Password
          </Link>
        </div>
      </div>
    </div>
  );
}

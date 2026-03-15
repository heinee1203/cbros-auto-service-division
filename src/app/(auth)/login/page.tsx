"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password");
    } else if (result?.url) {
      router.push(result.url);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="font-mono font-bold text-primary text-2xl">AS</span>
        </div>
        <h1 className="text-2xl font-bold text-white">AutoServ Pro</h1>
        <p className="text-sm text-white/50 mt-1">Shop Management System</p>
      </div>

      {/* Login form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 shadow-2xl space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent touch-target"
            placeholder="Enter your username"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent touch-target"
            placeholder="Enter your password"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-danger font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-accent hover:bg-accent-500 text-primary font-semibold rounded-lg transition-colors disabled:opacity-50 touch-target"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="text-center pt-2">
          <Link
            href="/pin-login"
            className="text-sm text-accent-600 hover:text-accent-700 font-medium"
          >
            Use PIN Login (Shop Floor)
          </Link>
        </div>
      </form>
    </div>
  );
}

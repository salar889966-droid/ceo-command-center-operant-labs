"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../lib/api";
import { Lock, Mail, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  bootstrapKey: z.string().min(32, { message: "Enter the CEO bootstrap key supplied by the system administrator" }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);
    try {
      const { bootstrapKey, ...credentials } = data;
      const response = await api.post("/auth/register", credentials, {
        headers: { "x-ceo-bootstrap-key": bootstrapKey },
      });
      login(response.data.accessToken, response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to register. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4 relative overflow-hidden">
      {/* Background decorations matching the billing platform aesthetic */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[var(--color-electric-cyan)] opacity-5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500 opacity-5 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md glass-card p-8 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--surface-bright)] shadow-sm border border-[var(--border-subtle)] mb-6">
            <Lock className="w-8 h-8 text-[var(--foreground)]" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-2">
            CEO Command Center
          </h1>
          <p className="text-sm text-[var(--foreground-variant)]">
            Create your executive account
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-current" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-variant)]" />
              <input
                id="email"
                type="email"
                {...register("email")}
                placeholder="you@operantlabs.io"
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--foreground)] placeholder:text-[var(--foreground-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] focus:border-transparent transition-all"
                disabled={isSubmitting}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-variant)]" />
              <input
                id="password"
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--foreground)] placeholder:text-[var(--foreground-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] focus:border-transparent transition-all"
                disabled={isSubmitting}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="bootstrapKey">
              Initial CEO Setup Key
            </label>
            <input
              id="bootstrapKey"
              type="password"
              autoComplete="off"
              {...register("bootstrapKey")}
              placeholder="One-time setup key"
              className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-lg py-2.5 px-4 text-[var(--foreground)] placeholder:text-[var(--foreground-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] focus:border-transparent transition-all"
              disabled={isSubmitting}
            />
            {errors.bootstrapKey && (
              <p className="text-xs text-red-500 mt-1">{errors.bootstrapKey.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-solid mt-4 h-11 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--foreground-variant)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--foreground)] hover:underline font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

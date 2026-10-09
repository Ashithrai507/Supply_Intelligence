import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SUPABASE_CONFIGURED } from "../api/supabase";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        window.location.href = "/";
      } else {
        setError("Invalid email or password. Please verify your institutional credentials.");
      }
    } catch {
      setError("Unable to connect to authentication server. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative selection:bg-indigo-500 selection:text-white">
      {/* Subtle modern background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Minimal Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30">
              <HeartPulse className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              MediPulse
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Sign in to access your hospital&apos;s inventory, forecasts, and redistribution pipeline
          </p>
        </div>

        {/* Minimal Clean Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-md space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Institutional Email or Hospital Code
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. hospital-a@medipulse.health or H01"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <span>{loading ? "Authenticating…" : "Sign In"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {SUPABASE_CONFIGURED ? (
            <div className="pt-1 text-center">
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                New here? Create an account
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Shield className="h-3.5 w-3.5 text-indigo-400" />
                <span>Demo Credentials</span>
              </div>
              <p>
                Email / Code: <code className="text-indigo-300 font-mono">hospital-a@medipulse.health</code> (or <code className="text-indigo-300 font-mono">H01</code>)
              </p>
              <p>
                Password: <code className="text-indigo-300 font-mono">supplyPass2026!</code>
              </p>
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            JWT &amp; RBAC Secured
          </span>
          <span>Regional Network Gateway</span>
        </div>
      </div>
    </div>
  );
}

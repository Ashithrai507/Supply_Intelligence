import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  HeartPulse,
  Hospital,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

import { getHospitalsList } from "../api/medpredict";
import type { HospitalOption } from "../api/forecast";
import { PRESET_HOSPITALS, useAuth } from "../context/AuthContext";
import { SUPABASE_CONFIGURED } from "../api/supabase";

const SIGNUP_ROLES = ["FACILITY_MANAGER", "ANALYST"] as const;

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [role, setRole] = useState<string>("FACILITY_MANAGER");

  const [hospitals, setHospitals] = useState<HospitalOption[]>(PRESET_HOSPITALS);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getHospitalsList()
      .then((list) => {
        if (active && list.length > 0) setHospitals(list);
      })
      .catch(() => {
        // Backend unreachable or auth-gated → fall back to preset hospitals.
      })
      .finally(() => {
        if (active) setLoadingHospitals(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in your name, email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!facilityId) {
      setError("Please select your hospital.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp({ name, email, password, facilityId, role });
      if (result.error) {
        setError(result.error);
      } else if (result.needsEmailConfirmation) {
        setStatus(
          "Account created! Check your inbox for a confirmation email from Supabase, then sign in.",
        );
      }
    } catch {
      setError("Unable to reach the authentication provider. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative selection:bg-indigo-500 selection:text-white">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30">
              <HeartPulse className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">MediPulse</span>
          </div>
          <p className="text-xs text-slate-400">
            Create a hospital account to access inventory, forecasts, and redistribution
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-md space-y-5">
          {!SUPABASE_CONFIGURED && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Supabase Auth is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Sign-up is
              unavailable until it is.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {status && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{status}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. Dr. Priya Nair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  placeholder="you@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Hospital</label>
              <div className="relative">
                <Hospital className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  required
                  className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60"
                  disabled={loadingHospitals}
                >
                  <option value="" disabled>
                    {loadingHospitals ? "Loading hospitals…" : "Select your hospital"}
                  </option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Role</label>
              <div className="grid grid-cols-2 gap-2">
                {SIGNUP_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      role === r
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                        : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {r === "FACILITY_MANAGER" ? "Facility Manager" : "Analyst"}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !SUPABASE_CONFIGURED}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating account…</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          <div className="pt-1 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Supabase Auth Secured
          </span>
          <span>Regional Network Gateway</span>
        </div>
      </div>
    </div>
  );
}
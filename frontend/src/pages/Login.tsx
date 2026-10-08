import React, { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { PRESET_HOSPITALS, useAuth, type HospitalProfile } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [selectedHospital, setSelectedHospital] = useState<HospitalProfile>(PRESET_HOSPITALS[0]);
  const [email, setEmail] = useState(PRESET_HOSPITALS[0].email);
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPreset = (h: HospitalProfile) => {
    setSelectedHospital(h);
    setEmail(h.email);
    setPassword("supplyPass2026!");
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please provide a valid institutional email or hospital code.");
      return;
    }
    const success = login(email, password);
    if (!success) {
      setError("Unable to authenticate organization credentials. Please verify your access key.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background ambient medical glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
            <Shield className="h-3.5 w-3.5 text-cyan-400" />
            <span>Secure Clinical Gateway • Organization-Scoped Telemetry</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 shadow-lg shadow-indigo-500/30">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              MediPulse <span className="text-indigo-400">Intelligence</span>
            </h1>
          </div>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Sign in to access your organization&apos;s real-time inventory, surge forecasts, and peer redistribution pipeline.
          </p>
        </div>

        {/* Dual Layout: Quick Preset Picker + Credentials Form */}
        <div className="grid gap-6 md:grid-cols-12 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {/* Left Column: Quick Organization Selector */}
          <div className="md:col-span-6 space-y-4 border-b md:border-b-0 md:border-r border-slate-800 pb-6 md:pb-0 md:pr-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-400" />
                <span>Select Your Organization</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Each profile views and manages exclusively their own facility data.
              </p>
            </div>

            <div className="space-y-2.5">
              {PRESET_HOSPITALS.map((h) => {
                const isSelected = selectedHospital.id === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleSelectPreset(h)}
                    className={`w-full text-left rounded-2xl p-3.5 transition-all flex items-start justify-between border ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/60 shadow-md shadow-indigo-950/50"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{h.name}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] font-mono text-slate-300">
                          {h.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {h.region} • {h.bedCapacity} beds
                      </p>
                      <p className="text-[10px] text-indigo-300 font-medium">
                        User: {h.userName} ({h.role})
                      </p>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Credentials Form */}
          <div className="md:col-span-6 flex flex-col justify-between md:pl-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-cyan-400" />
                  <span>Organization Credentials</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-filled for <strong className="text-white">{selectedHospital.name}</strong>
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Institutional Email / Facility ID
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Access Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
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

              <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Authorized Role:</span>
                  <span className="font-bold text-white">{selectedHospital.role}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Access Scope:</span>
                  <span className="font-semibold text-emerald-400">Restricted to {selectedHospital.name}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-blue-500 active:scale-98 transition-all"
              >
                <span>Sign In to {selectedHospital.name}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Audit Logged
              </span>
              <span>Regional Supply Net v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

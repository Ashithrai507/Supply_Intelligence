import { useState, useRef, useEffect } from "react";
import {
  Check,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { PRESET_HOSPITALS, useAuth } from "../context/AuthContext";

export default function UserProfileMenu() {
  const { user, logout, switchHospital } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Clean Profile Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none shadow-2xs"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-tr ${user.avatarColor} text-white font-bold text-[10px]`}
        >
          {user.name.charAt(0)}
        </span>
        <span className="font-semibold text-slate-800 text-xs hidden sm:inline truncate max-w-[150px]">
          {user.name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {/* Clean Dropdown Menu */}
      {open && (
        <div className="absolute right-0 mt-1.5 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg z-50">
          {/* Active Profile Info */}
          <div className="rounded-lg bg-slate-50 p-2.5 space-y-1 mb-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs truncate">{user.name}</span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-mono font-bold text-indigo-700">
                {user.code}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {user.userName} • {user.role}
            </p>
          </div>

          {/* Switch Organization */}
          <div className="py-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
              Switch Facility
            </p>
            <div className="space-y-0.5">
              {PRESET_HOSPITALS.map((h) => {
                const isActive = h.id === user.id;
                return (
                  <button
                    key={h.id}
                    onClick={() => {
                      switchHospital(h.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-left transition-colors ${
                      isActive
                        ? "bg-slate-900 text-white font-semibold"
                        : "text-slate-700 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    <span className="truncate">{h.name}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-white shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logout */}
          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

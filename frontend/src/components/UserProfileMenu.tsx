import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function UserProfileMenu() {
  const { user, logout } = useAuth();
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
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none shadow-2xs dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-tr ${user.avatarColor} text-white font-bold text-[10px]`}
        >
          {user.name.charAt(0)}
        </span>
        <span className="font-semibold text-slate-800 text-xs hidden sm:inline truncate max-w-[150px] dark:text-slate-200">
          {user.name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
      </button>

      {/* Clean Dropdown Menu */}
      {open && (
        <div className="absolute right-0 mt-1.5 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg z-50 dark:bg-slate-900 dark:border-slate-800">
          {/* Active Profile Info */}
          <div className="rounded-lg bg-slate-50 p-2.5 space-y-1 mb-2 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs truncate dark:text-slate-100">{user.name}</span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-mono font-bold text-indigo-700 dark:text-indigo-300">
                {user.code}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {user.userName} • {user.role}
            </p>
            <p className="text-[10px] text-slate-400 truncate dark:text-slate-500">{user.email}</p>
          </div>

          {/* Logout */}
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
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

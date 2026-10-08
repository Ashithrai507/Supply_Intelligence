import React, { createContext, useContext, useEffect, useState } from "react";

export interface HospitalProfile {
  id: string; // "h1", "h2", "h3", "h4"
  name: string;
  code: string;
  email: string;
  role: string;
  userName: string;
  region: string;
  bedCapacity: number;
  tier: string;
  avatarColor: string;
}

export const PRESET_HOSPITALS: HospitalProfile[] = [
  {
    id: "h1",
    name: "City General Hospital",
    code: "CGH-01",
    email: "citygeneral@medipulse.health",
    role: "Supply Chain Director",
    userName: "Dr. Marcus Vance",
    region: "Metropolitan Central",
    bedCapacity: 650,
    tier: "Tier 1 Trauma Center",
    avatarColor: "from-blue-600 to-indigo-600",
  },
  {
    id: "h2",
    name: "Riverside District Hospital",
    code: "RDH-02",
    email: "riverside@medipulse.health",
    role: "Lead Pharmacist",
    userName: "Elena Rostova, PharmD",
    region: "Riverside North",
    bedCapacity: 380,
    tier: "Regional Community Care",
    avatarColor: "from-cyan-600 to-teal-600",
  },
  {
    id: "h3",
    name: "St. Mary's Tertiary Care",
    code: "SMT-03",
    email: "stmarys@medipulse.health",
    role: "Clinical Procurement Head",
    userName: "Dr. Julian Mercer",
    region: "Eastern District",
    bedCapacity: 520,
    tier: "Tertiary Referral & Outbreak",
    avatarColor: "from-purple-600 to-indigo-600",
  },
  {
    id: "h4",
    name: "Lakeside Community Clinic",
    code: "LCC-04",
    email: "lakeside@medipulse.health",
    role: "Operations Supervisor",
    userName: "Clara Hughes, RN",
    region: "Lakeside Valley",
    bedCapacity: 120,
    tier: "Suburban Urgent Care",
    avatarColor: "from-emerald-600 to-teal-600",
  },
];

interface AuthContextType {
  user: HospitalProfile | null;
  login: (emailOrId: string, password?: string) => boolean;
  logout: () => void;
  switchHospital: (hospitalId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "medipulse_auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<HospitalProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as HospitalProfile;
      }
    } catch {
      // Fallback
    }
    // Default logged in as City General Hospital for instant seamless preview
    return PRESET_HOSPITALS[0];
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = (emailOrId: string, _password?: string): boolean => {
    const query = emailOrId.trim().toLowerCase();
    const found = PRESET_HOSPITALS.find(
      (h) =>
        h.id.toLowerCase() === query ||
        h.email.toLowerCase() === query ||
        h.name.toLowerCase().includes(query) ||
        h.code.toLowerCase() === query,
    );

    if (found) {
      setUser(found);
      return true;
    }

    // Default to the first hospital if unknown query entered
    setUser(PRESET_HOSPITALS[0]);
    return true;
  };

  const switchHospital = (hospitalId: string) => {
    const found = PRESET_HOSPITALS.find((h) => h.id === hospitalId);
    if (found) {
      setUser(found);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchHospital }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

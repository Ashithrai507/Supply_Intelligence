import React, { createContext, useContext, useEffect, useState } from "react";

export interface HospitalProfile {
  id: string; // real hospital_id from the dataset, e.g. "H01"
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

// Mirrors the seeded `data/synthetic/hospitals.csv` (H01–H04) so every page
// scopes to a real facility in the dataset.
export const PRESET_HOSPITALS: HospitalProfile[] = [
  {
    id: "H01",
    name: "Hospital A",
    code: "H01",
    email: "hospital-a@medipulse.health",
    role: "Supply Chain Director",
    userName: "Dr. Marcus Vance",
    region: "Bengaluru",
    bedCapacity: 250,
    tier: "Tier 1 Trauma Center",
    avatarColor: "from-blue-600 to-indigo-600",
  },
  {
    id: "H02",
    name: "Hospital B",
    code: "H02",
    email: "hospital-b@medipulse.health",
    role: "Lead Pharmacist",
    userName: "Elena Rostova, PharmD",
    region: "Mangaluru",
    bedCapacity: 400,
    tier: "Regional Community Care",
    avatarColor: "from-cyan-600 to-teal-600",
  },
  {
    id: "H03",
    name: "Hospital C",
    code: "H03",
    email: "hospital-c@medipulse.health",
    role: "Clinical Procurement Head",
    userName: "Dr. Julian Mercer",
    region: "Mysuru",
    bedCapacity: 180,
    tier: "Tertiary Referral & Outbreak",
    avatarColor: "from-purple-600 to-indigo-600",
  },
  {
    id: "H04",
    name: "Hospital D",
    code: "H04",
    email: "hospital-d@medipulse.health",
    role: "Operations Supervisor",
    userName: "Clara Hughes, RN",
    region: "Hubballi",
    bedCapacity: 600,
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
        const parsed = JSON.parse(saved) as HospitalProfile;
        // Ignore profiles persisted before the dataset migration (e.g. "h1").
        const match = PRESET_HOSPITALS.find((h) => h.id === parsed.id);
        if (match) {
          return match;
        }
      }
    } catch {
      // Fallback
    }
    // Default logged in as Hospital A for instant seamless preview
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

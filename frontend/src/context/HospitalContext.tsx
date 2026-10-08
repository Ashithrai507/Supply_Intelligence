import { createContext, useContext, useState, type ReactNode } from "react";

export interface Hospital {
  id: string;
  name: string;
  type: string;
  location: string;
  role: string;
}

export const HOSPITALS: Hospital[] = [
  {
    id: "h1",
    name: "City General Hospital",
    type: "Tertiary Referral",
    location: "Metro Central",
    role: "Facility Manager (City General)",
  },
  {
    id: "h2",
    name: "Riverside District Hospital",
    type: "District Hospital",
    location: "Riverside East",
    role: "Facility Manager (Riverside)",
  },
  {
    id: "h3",
    name: "St. Mary's Tertiary Care",
    type: "Specialty Medical Center",
    location: "North Suburbs",
    role: "Facility Manager (St. Mary's)",
  },
  {
    id: "h4",
    name: "Lakeside Community Clinic",
    type: "Primary Care Clinic",
    location: "Lakeside Basin",
    role: "Facility Manager (Lakeside)",
  },
];

interface HospitalContextType {
  activeHospitalId: string; // "h1", "h2", etc., or "all"
  setActiveHospitalId: (id: string) => void;
  activeHospital: Hospital | null; // null if "all"
  hospitals: Hospital[];
  isNetworkView: boolean;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: ReactNode }) {
  // Default to City General Hospital (h1) as requested by user ("first a hospital gets logged in")
  const [activeHospitalId, setActiveHospitalId] = useState<string>("h1");

  const activeHospital = HOSPITALS.find((h) => h.id === activeHospitalId) ?? null;
  const isNetworkView = activeHospitalId === "all";

  return (
    <HospitalContext.Provider
      value={{
        activeHospitalId,
        setActiveHospitalId,
        activeHospital,
        hospitals: HOSPITALS,
        isNetworkView,
      }}
    >
      {children}
    </HospitalContext.Provider>
  );
}

export function useHospital(): HospitalContextType {
  const context = useContext(HospitalContext);
  if (!context) {
    throw new Error("useHospital must be used within a HospitalProvider");
  }
  return context;
}

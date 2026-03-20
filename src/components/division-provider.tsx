"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { UserDivision } from "@/types/enums";

interface DivisionContextValue {
  activeDivision: UserDivision;
  setActiveDivision: (d: UserDivision) => void;
  canSwitch: boolean; // true only for ALL users
}

const DivisionContext = createContext<DivisionContextValue>({
  activeDivision: "ALL",
  setActiveDivision: () => {},
  canSwitch: false,
});

export function useDivision() {
  return useContext(DivisionContext);
}

interface DivisionProviderProps {
  userDivision: UserDivision;
  children: React.ReactNode;
}

const STORAGE_KEY = "autoserv-active-division";

export function DivisionProvider({
  userDivision,
  children,
}: DivisionProviderProps) {
  const canSwitch = userDivision === "ALL";

  const [activeDivision, setActiveDivisionState] = useState<UserDivision>(
    userDivision
  );

  // Load from localStorage on mount (only for ALL users)
  useEffect(() => {
    if (!canSwitch) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "MECHANICAL" || stored === "BODY_PAINT" || stored === "ALL") {
      setActiveDivisionState(stored);
    }
  }, [canSwitch]);

  const setActiveDivision = (d: UserDivision) => {
    if (!canSwitch) return;
    setActiveDivisionState(d);
    localStorage.setItem(STORAGE_KEY, d);
  };

  return (
    <DivisionContext.Provider
      value={{
        activeDivision: canSwitch ? activeDivision : userDivision,
        setActiveDivision,
        canSwitch,
      }}
    >
      {children}
    </DivisionContext.Provider>
  );
}

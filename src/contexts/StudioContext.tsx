import React, { createContext, useContext } from "react";

interface StudioContextType {
  studioId: string | null;
  isLoading: boolean;
}

const StudioContext = createContext<StudioContextType>({
  studioId: null,
  isLoading: false,
});

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used within StudioProvider");
  }
  return context;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  return (
    <StudioContext.Provider value={{ studioId: null, isLoading: false }}>
      {children}
    </StudioContext.Provider>
  );
}
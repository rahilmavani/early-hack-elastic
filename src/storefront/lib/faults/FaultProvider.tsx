"use client";

import { createContext, Suspense, useContext, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isFaultName, type FaultName } from "@/lib/faults/faults";
import { faultStore } from "@/lib/faults/faultStore";
import { usePersistedStore } from "@/lib/store/persistedStore";

const FaultContext = createContext<FaultName | null>(null);

function FaultUrlSync() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("fault");

  useEffect(() => {
    if (requested === null) {
      return;
    }
    if (requested === "none") {
      faultStore.set(null);
    } else if (isFaultName(requested)) {
      faultStore.set(requested);
    }
  }, [requested]);

  return null;
}

export function FaultProvider({ children }: { children: React.ReactNode }) {
  const fault = usePersistedStore(faultStore);

  return (
    <FaultContext.Provider value={fault}>
      <Suspense fallback={null}>
        <FaultUrlSync />
      </Suspense>
      {children}
    </FaultContext.Provider>
  );
}

export function useFault() {
  return useContext(FaultContext);
}

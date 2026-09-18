import type { FaultName } from "@/lib/faults/faults";
import { createPersistedStore } from "@/lib/store/persistedStore";

export const faultStore = createPersistedStore<FaultName | null>(
  "northline.fault",
  null,
);

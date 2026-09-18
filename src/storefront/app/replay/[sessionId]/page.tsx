"use client";

import { useParams } from "next/navigation";
import { ReplayViewer } from "@/components/replay/ReplayViewer";

export default function ReplayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <ReplayViewer key={sessionId} sessionId={sessionId} />;
}

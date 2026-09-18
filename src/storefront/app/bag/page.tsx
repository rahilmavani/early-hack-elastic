import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { BagView } from "@/components/bag/BagView";

export const metadata: Metadata = { title: "Bag" };

export default function BagPage() {
  return (
    <main>
      <Container className="py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Bag</h1>
        <BagView />
      </Container>
    </main>
  );
}

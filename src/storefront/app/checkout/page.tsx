import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <main>
      <Container className="py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Checkout</h1>
        <CheckoutForm />
      </Container>
    </main>
  );
}

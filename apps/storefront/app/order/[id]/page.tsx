import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { OrderConfirmation } from "@/components/order/OrderConfirmation";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;

  return (
    <main>
      <Container className="py-12">
        <OrderConfirmation orderId={id} />
      </Container>
    </main>
  );
}

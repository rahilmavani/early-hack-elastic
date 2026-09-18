import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { withServerEvent } from "@/lib/telemetry/serverEvents";
import { deliveryFeeFor } from "@/lib/bag";
import { getProducts } from "@/lib/catalogue";
import { createOrderId, type Order, type OrderRequest } from "@/lib/orders";

const ordersDir = join(process.cwd(), ".data", "orders");

function isValidRequest(body: unknown): body is OrderRequest {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const candidate = body as Partial<OrderRequest>;
  return (
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    typeof candidate.email === "string" &&
    typeof candidate.address === "object" &&
    candidate.address !== null &&
    (candidate.delivery === "standard" || candidate.delivery === "express")
  );
}

async function handlePost(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidRequest(body)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  const products = getProducts();
  const unknownItem = body.items.find(
    (item) => !products.some((product) => product.id === item.productId),
  );
  if (unknownItem) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  if (request.headers.get("x-fault") === "slow-payment") {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    return NextResponse.json(
      { error: "Payment gateway timed out" },
      { status: 504 },
    );
  }

  const subtotal = body.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const deliveryFee = deliveryFeeFor(subtotal, body.delivery);

  const order: Order = {
    ...body,
    id: createOrderId(),
    createdAt: new Date().toISOString(),
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
  };

  await mkdir(ordersDir, { recursive: true });
  await writeFile(
    join(ordersDir, `${order.id}.json`),
    JSON.stringify(order, null, 2),
  );

  return NextResponse.json(order, { status: 201 });
}

export const POST = withServerEvent("/api/orders", handlePost);

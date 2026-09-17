"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddressFields } from "@/components/checkout/AddressFields";
import { ContactFields } from "@/components/checkout/ContactFields";
import { DeliveryOptions } from "@/components/checkout/DeliveryOptions";
import { FormSection } from "@/components/checkout/FormSection";
import { PaymentFields } from "@/components/checkout/PaymentFields";
import { OrderSummary } from "@/components/bag/OrderSummary";
import { Button } from "@/components/ui/Button";
import { bagTotals, resolveBagLines } from "@/lib/bag";
import {
  emptyCheckoutValues,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutValues,
} from "@/lib/checkout";
import type { Order, OrderRequest } from "@/lib/orders";
import { useBag } from "@/lib/store/BagProvider";
import { useOrders } from "@/lib/store/OrdersProvider";

export function CheckoutForm() {
  const router = useRouter();
  const bag = useBag();
  const orders = useOrders();
  const [values, setValues] = useState<CheckoutValues>(emptyCheckoutValues);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lines = resolveBagLines(bag.items);
  const totals = bagTotals(lines, values.delivery);
  const errorCount = Object.keys(errors).length;

  if (!bag.hydrated) {
    return null;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-muted text-sm">Your bag is empty.</p>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="secondary">Continue shopping</Button>
        </Link>
      </div>
    );
  }

  function handleChange(field: keyof CheckoutValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateCheckout(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const request: OrderRequest = {
      items: lines.map((line) => ({
        productId: line.productId,
        size: line.size,
        quantity: line.quantity,
        unitPrice: line.product.price,
      })),
      email: values.email,
      phone: values.phone,
      address: {
        fullName: values.fullName,
        line1: values.line1,
        line2: values.line2,
        city: values.city,
        state: values.state,
        pincode: values.pincode,
      },
      delivery: values.delivery,
      cardLast4: values.cardNumber.replace(/\s/g, "").slice(-4),
    };

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error(`Order failed with status ${response.status}`);
      }
      const order = (await response.json()) as Order;
      orders.addOrder(order);
      bag.clear();
      router.push(`/order/${order.id}`);
    } catch {
      setSubmitError("We couldn't place your order. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-10 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-8">
        <FormSection title="Contact">
          <ContactFields
            values={values}
            errors={errors}
            onChange={handleChange}
          />
        </FormSection>

        <FormSection title="Delivery address">
          <AddressFields
            values={values}
            errors={errors}
            onChange={handleChange}
          />
        </FormSection>

        <FormSection title="Delivery method">
          <DeliveryOptions
            value={values.delivery}
            subtotal={totals.subtotal}
            onChange={(value) => handleChange("delivery", value)}
          />
        </FormSection>

        <FormSection title="Payment">
          <PaymentFields
            values={values}
            errors={errors}
            onChange={handleChange}
          />
        </FormSection>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <OrderSummary
          subtotal={totals.subtotal}
          delivery={totals.delivery}
          total={totals.total}
        >
          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {submitting ? "Placing order..." : "Place order"}
          </Button>
          {errorCount > 0 && (
            <p role="alert" className="text-danger mt-3 text-sm">
              Please fix the {errorCount} highlighted{" "}
              {errorCount === 1 ? "field" : "fields"}.
            </p>
          )}
          {submitError && (
            <p role="alert" className="text-danger mt-3 text-sm">
              {submitError}
            </p>
          )}
        </OrderSummary>
      </div>
    </form>
  );
}

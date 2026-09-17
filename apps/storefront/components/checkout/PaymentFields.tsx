import { Input } from "@/components/ui/Input";
import {
  formatCardNumber,
  formatExpiry,
  type CheckoutErrors,
  type CheckoutValues,
} from "@/lib/checkout";

type PaymentFieldsProps = {
  values: CheckoutValues;
  errors: CheckoutErrors;
  onChange: (field: keyof CheckoutValues, value: string) => void;
};

export function PaymentFields({
  values,
  errors,
  onChange,
}: PaymentFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Card number"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0000 0000 0000 0000"
        className="sm:col-span-2"
        value={values.cardNumber}
        error={errors.cardNumber}
        onChange={(event) =>
          onChange("cardNumber", formatCardNumber(event.target.value))
        }
      />
      <Input
        label="Name on card"
        autoComplete="off"
        className="sm:col-span-2"
        value={values.cardName}
        error={errors.cardName}
        onChange={(event) => onChange("cardName", event.target.value)}
      />
      <Input
        label="Expiry"
        inputMode="numeric"
        autoComplete="off"
        placeholder="MM/YY"
        value={values.expiry}
        error={errors.expiry}
        onChange={(event) =>
          onChange("expiry", formatExpiry(event.target.value))
        }
      />
      <Input
        label="CVV"
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        value={values.cvv}
        error={errors.cvv}
        onChange={(event) =>
          onChange("cvv", event.target.value.replace(/\D/g, ""))
        }
      />
      <p className="text-ink-faint text-xs sm:col-span-2">
        This is a demo store. No payment is taken and card details are not
        stored.
      </p>
    </div>
  );
}

import { Input } from "@/components/ui/Input";
import type { CheckoutErrors, CheckoutValues } from "@/lib/checkout";

type ContactFieldsProps = {
  values: CheckoutValues;
  errors: CheckoutErrors;
  onChange: (field: keyof CheckoutValues, value: string) => void;
};

export function ContactFields({
  values,
  errors,
  onChange,
}: ContactFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={(event) => onChange("email", event.target.value)}
      />
      <Input
        label="Phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={values.phone}
        error={errors.phone}
        onChange={(event) => onChange("phone", event.target.value)}
      />
    </div>
  );
}

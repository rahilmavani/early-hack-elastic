import { Input } from "@/components/ui/Input";
import type { CheckoutErrors, CheckoutValues } from "@/lib/checkout";

type AddressFieldsProps = {
  values: CheckoutValues;
  errors: CheckoutErrors;
  onChange: (field: keyof CheckoutValues, value: string) => void;
};

export function AddressFields({
  values,
  errors,
  onChange,
}: AddressFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Full name"
        autoComplete="name"
        className="sm:col-span-2"
        value={values.fullName}
        error={errors.fullName}
        onChange={(event) => onChange("fullName", event.target.value)}
      />
      <Input
        label="Address line 1"
        autoComplete="address-line1"
        className="sm:col-span-2"
        value={values.line1}
        error={errors.line1}
        onChange={(event) => onChange("line1", event.target.value)}
      />
      <Input
        label="Address line 2 (optional)"
        autoComplete="address-line2"
        className="sm:col-span-2"
        value={values.line2}
        onChange={(event) => onChange("line2", event.target.value)}
      />
      <Input
        label="City"
        autoComplete="address-level2"
        value={values.city}
        error={errors.city}
        onChange={(event) => onChange("city", event.target.value)}
      />
      <Input
        label="State"
        autoComplete="address-level1"
        value={values.state}
        error={errors.state}
        onChange={(event) => onChange("state", event.target.value)}
      />
      <Input
        label="PIN code"
        inputMode="numeric"
        autoComplete="postal-code"
        value={values.pincode}
        error={errors.pincode}
        onChange={(event) => onChange("pincode", event.target.value)}
      />
    </div>
  );
}

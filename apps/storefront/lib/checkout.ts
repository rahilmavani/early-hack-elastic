export type DeliveryMethod = "standard" | "express";

export type CheckoutValues = {
  email: string;
  phone: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  delivery: DeliveryMethod;
  cardNumber: string;
  cardName: string;
  expiry: string;
  cvv: string;
};

export type CheckoutErrors = Partial<Record<keyof CheckoutValues, string>>;

export const emptyCheckoutValues: CheckoutValues = {
  email: "",
  phone: "",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  delivery: "standard",
  cardNumber: "",
  cardName: "",
  expiry: "",
  cvv: "",
};

export const deliveryOptions: {
  value: DeliveryMethod;
  label: string;
  eta: string;
}[] = [
  { value: "standard", label: "Standard", eta: "3 to 5 working days" },
  { value: "express", label: "Express", eta: "Next working day" },
];

export function validateCheckout(values: CheckoutValues): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address";
  }
  if (!/^\d{10}$/.test(values.phone.replace(/\s/g, ""))) {
    errors.phone = "Enter a 10-digit phone number";
  }
  if (values.fullName.trim().length < 2) {
    errors.fullName = "Enter your full name";
  }
  if (values.line1.trim().length < 3) {
    errors.line1 = "Enter your street address";
  }
  if (values.city.trim().length < 2) {
    errors.city = "Enter your city";
  }
  if (values.state.trim().length < 2) {
    errors.state = "Enter your state";
  }
  if (!/^\d{6}$/.test(values.pincode)) {
    errors.pincode = "Enter a 6-digit PIN code";
  }
  if (values.cardNumber.replace(/\s/g, "").length !== 16) {
    errors.cardNumber = "Enter a 16-digit card number";
  }
  if (values.cardName.trim().length < 2) {
    errors.cardName = "Enter the name on the card";
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(values.expiry)) {
    errors.expiry = "Use MM/YY";
  }
  if (!/^\d{3}$/.test(values.cvv)) {
    errors.cvv = "3 digits";
  }

  return errors;
}

export function formatCardNumber(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

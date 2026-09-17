type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Checkbox({ label, ...rest }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="accent-ink size-4" {...rest} />
      <span>{label}</span>
    </label>
  );
}

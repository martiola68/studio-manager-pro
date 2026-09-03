type BooleanSelectProps = {
  value: boolean | null | undefined;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  className?: string;
};

export function BooleanSelect({
  value,
  disabled = false,
  onChange,
  className = "",
}: BooleanSelectProps) {
  return (
    <select
      value={value ? "SI" : "NO"}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value === "SI")}
      className={`h-8 w-[70px] rounded-md border border-slate-300 bg-white px-2 text-center text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <option value="NO">NO</option>
      <option value="SI">SI</option>
    </select>
  );
}

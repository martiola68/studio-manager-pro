import { Save, Printer, LogOut } from "lucide-react";

type FormStickyHeaderProps = {
  title: string;
  subtitle?: string;
  onSave: () => void;
  onPrint: () => void;
  onClose: () => void;
  saving?: boolean;
};

export default function FormStickyHeader({
  title,
  subtitle,
  onSave,
  onPrint,
  onClose,
  saving = false,
}: FormStickyHeaderProps) {
  return (
    <div className="no-print sticky top-[118px] z-40 border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-lg text-slate-500">{subtitle}</p> : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              title="Salva"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={onPrint}
              title="Stampa"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600 transition hover:bg-sky-100"
            >
              <Printer className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Chiudi"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

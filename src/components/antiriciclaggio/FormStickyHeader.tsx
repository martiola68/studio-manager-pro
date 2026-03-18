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
    <div className="no-print sticky top-0 z-40 border-b bg-white">
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
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-black text-white disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={onPrint}
              title="Stampa"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-slate-900"
            >
              <Printer className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Chiudi"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-slate-900"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

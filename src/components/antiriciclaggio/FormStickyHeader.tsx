import { Save, Printer, LogOut, Send } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  onSave?: () => void;
  onPrint?: () => void;
  onClose?: () => void;
  onSendToClient?: () => void;
  sendToClientDisabled?: boolean;
  saving?: boolean;
};

export default function FormStickyHeader({
  title,
  subtitle,
  onSave,
  onPrint,
  onClose,
  onSendToClient,
  sendToClientDisabled = false,
  saving = false,
}: Props) {
  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-8 md:py-5">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-600 md:text-base">{subtitle}</p>
          ) : null}
        </div>

       <div className="flex shrink-0 items-center gap-3">
  <button
    type="button"
    onClick={onSave}
    disabled={saving}
    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400 bg-emerald-100 text-emerald-700 shadow-sm transition hover:bg-emerald-200 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
    title="Salva"
  >
    <Save className="h-5 w-5" />
  </button>

  <button
    type="button"
    onClick={onPrint}
    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400 bg-sky-100 text-sky-700 shadow-sm transition hover:bg-sky-200 hover:text-sky-800"
    title="Stampa"
  >
    <Printer className="h-5 w-5" />
  </button>

  <button
    type="button"
    onClick={onSendToClient}
    disabled={sendToClientDisabled}
    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400 bg-white text-sky-700 shadow-sm transition hover:bg-sky-50 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
    title="Invia AV4 al cliente"
  >
    <Send className="h-5 w-5" />
  </button>

  <button
    type="button"
    onClick={onClose}
    className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-rose-400 bg-rose-100 text-rose-700 shadow-sm transition hover:bg-rose-200 hover:text-rose-800"
    title="Chiudi"
  >
    <LogOut className="h-5 w-5" />
  </button>
</div>
      </div>
    </div>
  );
}

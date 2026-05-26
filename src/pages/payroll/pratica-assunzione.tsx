import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PraticaAssunzionePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">
          Modello pratica assunzione
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          Sezione in preparazione.
        </p>

        <Link
          href="/presenze"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna al menu presenze
        </Link>
      </div>
    </div>
  );
}

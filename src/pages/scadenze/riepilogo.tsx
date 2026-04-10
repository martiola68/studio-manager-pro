import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const supabase = getSupabaseClient();

const studioId = "f9d3ca10-6134-4061-a2b4-0be74e8c7654";

const getColor = (stato: string) => {
  if (!stato) return "bg-gray-100 text-gray-600";

  if (
    ["INVIATO", "COMUNICATO", "DICHIARAZIONE PRESENTATA"].includes(stato)
  ) {
    return "bg-green-100 text-green-700";
  }

  if (stato === "DA FARE") {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
};

export default function ScadenzarioRiepilogo() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

 async function loadData() {
  const { data, error } = await (supabase as any)
    .from("vw_scadenzario_dashboard_societa")
    .select("*")
    .eq("studio_id", studioId)
    .order("nominativo", { ascending: true });

  if (error) {
    console.error("Errore caricamento riepilogo:", error);
    setRows([]);
    return;
  }

  setRows(data || []);
}

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">
        Scadenzario Riepilogativo
      </h1>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Nominativo</th>
            <th className="p-2">Stato</th>
            <th className="p-2">IVA</th>
            <th className="p-2">Fiscali</th>
            <th className="p-2">Bilanci</th>
            <th className="p-2">770</th>
            <th className="p-2">CCGG</th>
            <th className="p-2">CU</th>
            <th className="p-2">IMU</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.cliente_id} className="border-t">
              <td className="p-2">{r.nominativo}</td>

              <td className={`p-2 text-center ${getColor(r.stato_generale)}`}>
                {r.stato_generale}
              </td>

              <td className={`p-2 text-center ${getColor(r.stato_iva)}`}>
                {r.stato_iva}
              </td>

              <td className={`p-2 text-center ${getColor(r.stato_fiscali)}`}>
                {r.stato_fiscali}
              </td>

              <td className={`p-2 text-center ${getColor(r.stato_bilanci)}`}>
                {r.stato_bilanci}
              </td>

              <td className={`p-2 text-center ${getColor(r.stato_770)}`}>
                {r.stato_770}
              </td>

              <td className={`p-2 text-center ${getColor(r.stato_ccgg)}`}>
                {r.stato_ccgg}
              </td>

              <td className={`p-2 text-center ${getColor(r.stato_cu)}`}>
                {r.stato_cu}
              </td>

              <td className={`p-2 text-center ${getColor(r.stato_imu)}`}>
                {r.stato_imu}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

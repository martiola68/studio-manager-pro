import { useEffect, useState } from 'react'
import { supabase } from 'src/lib/supabase'

type PrestazioneAR = {
  id: number
  TipoPrestazioneAR: string
  RischioTipoPrestAR: string
  PunteggioPrestAR: number
}

export default function ElencoPrestazioniARPage() {
  const [rows, setRows] = useState<PrestazioneAR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('tbElencoPrestAR')
      .select('id, TipoPrestazioneAR, RischioTipoPrestAR, PunteggioPrestAR')
      .order('TipoPrestazioneAR', { ascending: true })

    if (error) {
      setError(error.message)
      setRows([])
    } else {
      setRows(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div style={{ padding: '24px' }}>
      <h1>Elenco Prestazioni AR</h1>

      {loading && <p>Caricamento...</p>}

      {error && (
        <p style={{ color: 'red' }}>
          Errore: {error}
        </p>
      )}

      {!loading && !error && (
        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: '#fff',
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Tipo Prestazione AR</th>
                <th style={thStyle}>Rischio</th>
                <th style={thStyle}>Punteggio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.TipoPrestazioneAR}</td>
                  <td style={tdStyle}>{row.RischioTipoPrestAR}</td>
                  <td style={tdStyle}>{row.PunteggioPrestAR}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={3}>
                    Nessun dato presente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '10px',
  textAlign: 'left',
  background: '#f5f5f5',
}

const tdStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '10px',
  textAlign: 'left',
}

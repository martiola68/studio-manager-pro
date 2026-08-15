import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const supabaseAdmin =
  getSupabaseAdmin();

/*
 * =====================================================
 * FORMATTAZIONE
 * =====================================================
 */

function n(value: any) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function euro(value: any) {
  return n(value).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
}

function percent(value: any) {
  return `${n(value).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}%`;
}

function numero(value: any) {
  return n(value).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function dataIT(
  value?: string | null
) {
  if (!value) return "-";

  const [y, m, d] =
    String(value)
      .slice(0, 10)
      .split("-");

  return `${d}/${m}/${y}`;
}

function deltaPercent(
  attuale: number,
  precedente: number
) {
  if (!precedente) {
    return null;
  }

  return (
    ((attuale - precedente) /
      Math.abs(precedente)) *
    100
  );
}

function deltaPP(
  attuale: number,
  precedente: number
) {
  return attuale - precedente;
}

function formatDeltaPercent(
  value: number | null
) {
  if (value === null) {
    return "-";
  }

  const segno =
    value > 0 ? "+" : "";

  return `${segno}${value.toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )}%`;
}

function formatDeltaPP(
  value: number | null
) {
  if (value === null) {
    return "-";
  }

  const segno =
    value > 0 ? "+" : "";

  return `${segno}${value.toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )} p.p.`;
}

function margine(
  valore: number,
  ricavi: number
) {
  if (!ricavi) return 0;

  return (
    (valore / ricavi) *
    100
  );
}

/*
 * =====================================================
 * API
 * =====================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    const {
      searchParams,
    } = new URL(req.url);

    const clienteId =
      searchParams.get(
        "cliente_id"
      );

    const anno =
      searchParams.get(
        "anno"
      );

    if (!clienteId) {
      return NextResponse.json(
        {
          error:
            "cliente_id mancante",
        },
        {
          status: 400,
        }
      );
    }

    if (!anno) {
      return NextResponse.json(
        {
          error:
            "anno mancante",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 1. CLIENTE
     * =====================================================
     */

    const {
      data: cliente,
      error: clienteError,
    } = await supabaseAdmin
      .from("tbclienti")
      .select(`
        id,
        ragione_sociale,
        codice_fiscale
      `)
      .eq(
        "id",
        clienteId
      )
      .maybeSingle();

    if (clienteError) {
      throw clienteError;
    }

    if (!cliente) {
      return NextResponse.json(
        {
          error:
            "Società non trovata",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * 2. CONTROLLI
     * =====================================================
     */

    const {
      data: controlli,
      error: controlliError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione"
      )
      .select(`
        id,
        cliente_id,
        cadenza_controllo,
        data_esecuzione,
        data_storico,
        step_1_completato,
        step_1_note,
        step_2_completato,
        step_2_note,
        step_3_completato,
        step_3_note,
        step_4_completato,
        step_4_note,
        created_at
      `)
      .eq(
        "cliente_id",
        clienteId
      );

    if (controlliError) {
      throw controlliError;
    }

    const controlloIds =
      (controlli || []).map(
        (item: any) =>
          item.id
      );

    if (
      controlloIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Nessun controllo disponibile",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =====================================================
     * 3. IMPORT ANNO
     * =====================================================
     */

    const {
      data: importsRaw,
      error: importsError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_import"
      )
      .select(`
        id,
        controllo_id,
        software_contabile,
        data_riferimento,
        numero_conti,
        conti_mappati,
        conti_da_mappare,
        stato,
        created_at
      `)
      .in(
        "controllo_id",
        controlloIds
      )
      .gte(
        "data_riferimento",
        `${anno}-01-01`
      )
      .lte(
        "data_riferimento",
        `${anno}-12-31`
      );

    if (importsError) {
      throw importsError;
    }

    /*
     * Se esistono vecchi import duplicati,
     * teniamo un solo import autorevole
     * per ogni data_riferimento:
     *
     * - elaborato prima;
     * - più recente a parità di stato.
     */

    const importsOrdinati =
      [
        ...(importsRaw || []),
      ].sort(
        (
          a: any,
          b: any
        ) => {
          const ae =
            a.stato ===
            "elaborato"
              ? 1
              : 0;

          const be =
            b.stato ===
            "elaborato"
              ? 1
              : 0;

          if (ae !== be) {
            return be - ae;
          }

          return (
            new Date(
              b.created_at || 0
            ).getTime() -
            new Date(
              a.created_at || 0
            ).getTime()
          );
        }
      );

    const mapImport =
      new Map<
        string,
        any
      >();

    for (
      const item
      of importsOrdinati
    ) {
      const data =
        String(
          item.data_riferimento ||
            ""
        ).slice(0, 10);

      if (
        data &&
        !mapImport.has(data)
      ) {
        mapImport.set(
          data,
          item
        );
      }
    }

    const imports =
      Array.from(
        mapImport.values()
      ).sort(
        (
          a: any,
          b: any
        ) =>
          String(
            a.data_riferimento
          ).localeCompare(
            String(
              b.data_riferimento
            )
          )
      );

    /*
     * =====================================================
     * 4. INDICI
     * =====================================================
     */

    const {
      data: indiciRaw,
      error: indiciError,
    } = await supabaseAdmin
      .from(
        "tbcontrollo_gestione_indici"
      )
      .select(`
        *,
        controllo_gestione_id
      `)
      .in(
        "controllo_gestione_id",
        controlloIds
      )
      .order(
        "updated_at",
        {
          ascending: false,
        }
      );

    if (indiciError) {
      throw indiciError;
    }

    /*
     * Un solo set di indici,
     * il più recente per controllo.
     */

    const indiciMap =
      new Map<
        string,
        any
      >();

    for (
      const item
      of indiciRaw || []
    ) {
      if (
        !indiciMap.has(
          item.controllo_gestione_id
        )
      ) {
        indiciMap.set(
          item.controllo_gestione_id,
          item
        );
      }
    }

    const periodi =
      imports.map(
        (imp: any) => ({
          import: imp,
          indici:
            indiciMap.get(
              imp.controllo_id
            ) || null,

          controllo:
            (controlli || [])
              .find(
                (c: any) =>
                  c.id ===
                  imp.controllo_id
              ) || null,
        })
      );

    const elaborati =
      periodi.filter(
        (item: any) =>
          item.import?.stato ===
            "elaborato" &&
          item.indici
      );

    if (
      elaborati.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Nessun periodo elaborato disponibile per il report",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =====================================================
     * 5. DATI DERIVATI
     * =====================================================
     */

    const get =
      (
        index: number,
        field: string
      ) =>
        n(
          elaborati[index]
            ?.indici?.[field]
        );

    const ricavi =
      elaborati.map(
        (_, i) =>
          get(
            i,
            "ricavi"
          )
      );

    const costi =
      elaborati.map(
        (_, i) =>
          get(
            i,
            "costi_operativi"
          )
      );

    const ebitda =
      elaborati.map(
        (_, i) =>
          get(
            i,
            "ebitda"
          )
      );

    const ebit =
      elaborati.map(
        (_, i) =>
          get(
            i,
            "ebit"
          )
      );

    const risultato =
      elaborati.map(
        (_, i) =>
          get(
            i,
            "utile_netto"
          )
      );

    const trimestrePuro =
      (
        valori: number[]
      ) =>
        valori.map(
          (
            value,
            index
          ) =>
            index === 0
              ? value
              : value -
                valori[
                  index - 1
                ]
        );

    const ricaviPuri =
      trimestrePuro(
        ricavi
      );

    const costiPuri =
      trimestrePuro(
        costi
      );

    const ebitdaPuro =
      trimestrePuro(
        ebitda
      );

    const ebitPuro =
      trimestrePuro(
        ebit
      );

    const risultatoPuro =
      trimestrePuro(
        risultato
      );

    const margineEbitda =
      ebitda.map(
        (value, i) =>
          margine(
            value,
            ricavi[i]
          )
      );

    const margineNetto =
      risultato.map(
        (value, i) =>
          margine(
            value,
            ricavi[i]
          )
      );

    const margineEbitdaPuro =
      ebitdaPuro.map(
        (value, i) =>
          margine(
            value,
            ricaviPuri[i]
          )
      );

    const margineNettoPuro =
      risultatoPuro.map(
        (value, i) =>
          margine(
            value,
            ricaviPuri[i]
          )
      );

    const ultimo =
      elaborati.length - 1;

    const ultimoIndici =
      elaborati[
        ultimo
      ].indici;

    /*
     * =====================================================
     * 6. PDF
     * =====================================================
     */

    const pdf =
      await PDFDocument.create();

    const regular =
      await pdf.embedFont(
        StandardFonts.Helvetica
      );

    const bold =
      await pdf.embedFont(
        StandardFonts.HelveticaBold
      );

    const PAGE_W =
      595.28;

    const PAGE_H =
      841.89;

    const MARGIN =
      45;

    let page =
      pdf.addPage([
        PAGE_W,
        PAGE_H,
      ]);

    let y =
      PAGE_H - 45;

    const navy =
      rgb(
        0.06,
        0.10,
        0.20
      );

    const gray =
      rgb(
        0.35,
        0.39,
        0.46
      );

    const lightGray =
      rgb(
        0.92,
        0.94,
        0.96
      );

    const green =
      rgb(
        0.05,
        0.50,
        0.28
      );

    const red =
      rgb(
        0.78,
        0.12,
        0.12
      );

    const blue =
      rgb(
        0.10,
        0.32,
        0.72
      );

    function newPage() {
      page =
        pdf.addPage([
          PAGE_W,
          PAGE_H,
        ]);

      y =
        PAGE_H - 45;
    }

    function ensure(
      heightNeeded:
        number
    ) {
      if (
        y -
          heightNeeded <
        55
      ) {
        newPage();
      }
    }

    function text(
      value: string,
      x = MARGIN,
      size = 9,
      isBold = false,
      color = navy
    ) {
      ensure(
        size + 10
      );

      page.drawText(
        String(value)
          .slice(0, 120),
        {
          x,
          y,
          size,
          font:
            isBold
              ? bold
              : regular,
          color,
        }
      );

      y -=
        size + 6;
    }

    function line() {
      page.drawLine({
        start: {
          x: MARGIN,
          y,
        },
        end: {
          x:
            PAGE_W -
            MARGIN,
          y,
        },
        thickness:
          0.6,
        color:
          lightGray,
      });

      y -= 13;
    }

    function section(
      title: string
    ) {
      ensure(35);

      y -= 5;

      text(
        title,
        MARGIN,
        13,
        true,
        navy
      );

      line();
    }

    function row(
      label: string,
      value: string,
      boldValue = false
    ) {
      ensure(20);

      page.drawText(
        label,
        {
          x:
            MARGIN + 10,
          y,
          size: 9,
          font: regular,
          color: gray,
        }
      );

      page.drawText(
        value,
        {
          x: 325,
          y,
          size: 9,
          font:
            boldValue
              ? bold
              : regular,
          color: navy,
        }
      );

      y -= 17;
    }

    function tableHeader(
      labels: string[],
      xs: number[]
    ) {
      ensure(28);

      page.drawRectangle({
        x: MARGIN,
        y: y - 5,
        width:
          PAGE_W -
          MARGIN * 2,
        height: 22,
        color:
          rgb(
            0.96,
            0.97,
            0.98
          ),
      });

      labels.forEach(
        (
          label,
          index
        ) => {
          page.drawText(
            label,
            {
              x:
                xs[index],
              y:
                y + 2,
              size: 8,
              font: bold,
              color: navy,
            }
          );
        }
      );

      y -= 25;
    }

    /*
     * =====================================================
     * COPERTINA / HEADER
     * =====================================================
     */

    text(
      "STUDIO MANAGER PRO",
      MARGIN,
      10,
      true,
      gray
    );

    y -= 3;

    text(
      "REPORT CONTROLLO DI GESTIONE",
      MARGIN,
      21,
      true,
      navy
    );

    y -= 6;

    line();

    text(
      `Societa: ${
        cliente.ragione_sociale ||
        "-"
      }`,
      MARGIN,
      11,
      true
    );

    text(
      `Codice fiscale: ${
        cliente.codice_fiscale ||
        "-"
      }`,
      MARGIN,
      9
    );

    text(
      `Esercizio: ${anno}`,
      MARGIN,
      9
    );

    text(
      `Periodicita: trimestrale`,
      MARGIN,
      9
    );

    text(
      `Data stampa: ${dataIT(
        new Date()
          .toISOString()
          .slice(0, 10)
      )}`,
      MARGIN,
      9
    );

    y -= 10;

    /*
     * =====================================================
     * KPI ANNUALI
     * =====================================================
     */

    section(
      "SINTESI ECONOMICO-FINANZIARIA"
    );

    row(
      "Ricavi",
      euro(
        ultimoIndici.ricavi
      ),
      true
    );

    row(
      "EBITDA",
      euro(
        ultimoIndici.ebitda
      ),
      true
    );

    row(
      "EBITDA margin",
      percent(
        margineEbitda[
          ultimo
        ]
      ),
      true
    );

    row(
      "EBIT",
      euro(
        ultimoIndici.ebit
      )
    );

    row(
      "Risultato netto",
      euro(
        ultimoIndici.utile_netto
      ),
      true
    );

    row(
      "Margine netto",
      percent(
        margineNetto[
          ultimo
        ]
      )
    );

    row(
      "ROI",
      percent(
        ultimoIndici.roi
      )
    );

    row(
      "ROE",
      percent(
        ultimoIndici.roe
      )
    );

    row(
      "ROS",
      percent(
        ultimoIndici.ros
      )
    );

    row(
      "ROA",
      percent(
        ultimoIndici.roa
      )
    );

    row(
      "Indice indebitamento",
      numero(
        ultimoIndici
          .indebitamento
      )
    );

    row(
      "Indice liquidita",
      numero(
        ultimoIndici
          .liquidita
      )
    );

    /*
     * =====================================================
     * PERIODI PRESENTI
     * =====================================================
     */

   section(
  "PERIODI CONTABILI"
);

elaborati.forEach(
  (
    item: any,
    index: number
  ) => {
    text(
      `Q${index + 1} - ${dataIT(
        item.import
          .data_riferimento
      )}`,
      MARGIN + 10,
      9,
      false,
      navy
    );
  }
);

    /*
     * =====================================================
     * CUMULATIVO
     * =====================================================
     */

    newPage();

    text(
      "ANDAMENTO CUMULATIVO",
      MARGIN,
      15,
      true,
      navy
    );

  text(
  "Valori progressivi dall'inizio dell'esercizio e variazioni rispetto al periodo precedente.",
  MARGIN,
  8,
  false,
  gray
);

text(
  "Valori espressi in euro.",
  MARGIN,
  8,
  false,
  gray
);

y -= 7;

    const xCum =
      [
        45,
        180,
        270,
        360,
        450,
      ];

    tableHeader(
      [
        "Indicatore",
        "Q1",
        "Q2",
        "Q3",
        "Q4",
      ],
      xCum
    );

    const cumulativeRows =
      [
        {
          label:
            "Ricavi",
          field:
            "ricavi",
          formatter:
            euro,
          delta:
            "percent",
        },
        {
          label:
            "EBITDA",
          field:
            "ebitda",
          formatter:
            euro,
          delta:
            "percent",
        },
        {
          label:
            "EBIT",
          field:
            "ebit",
          formatter:
            euro,
          delta:
            "percent",
        },
        {
          label:
            "Risultato netto",
          field:
            "utile_netto",
          formatter:
            euro,
          delta:
            "percent",
        },
        {
          label:
            "ROI",
          field:
            "roi",
          formatter:
            percent,
          delta:
            "pp",
        },
        {
          label:
            "ROE",
          field:
            "roe",
          formatter:
            percent,
          delta:
            "pp",
        },
        {
          label:
            "ROS",
          field:
            "ros",
          formatter:
            percent,
          delta:
            "pp",
        },
      ];

    for (
      const item
      of cumulativeRows
    ) {
      ensure(35);

      page.drawText(
        item.label,
        {
          x: xCum[0],
          y,
          size: 8,
          font: bold,
          color: navy,
        }
      );

      elaborati.forEach(
        (
          periodo: any,
          index: number
        ) => {
          const current =
            n(
              periodo
                .indici[
                item.field
              ]
            );

          let value =
            item.formatter(
              current
            );

          if (index > 0) {
            const previous =
              n(
                elaborati[
                  index - 1
                ].indici[
                  item.field
                ]
              );

            const delta =
              item.delta ===
              "pp"
                ? formatDeltaPP(
                    deltaPP(
                      current,
                      previous
                    )
                  )
                : formatDeltaPercent(
                    deltaPercent(
                      current,
                      previous
                    )
                  );

            value +=
              ` (${delta})`;
          }

          page.drawText(
            value.slice(
              0,
              22
            ),
            {
              x:
                xCum[
                  index + 1
                ],
              y,
              size: 7,
              font:
                regular,
              color:
                navy,
            }
          );
        }
      );

      y -= 21;
    }

    /*
     * Margini
     */

    for (
      const item
      of [
        {
          label:
            "EBITDA margin",
          values:
            margineEbitda,
        },
        {
          label:
            "Margine netto",
          values:
            margineNetto,
        },
      ]
    ) {
      page.drawText(
        item.label,
        {
          x: xCum[0],
          y,
          size: 8,
          font: bold,
          color: navy,
        }
      );

      item.values.forEach(
        (
          current,
          index
        ) => {
          let value =
            percent(
              current
            );

          if (index > 0) {
            value += ` (${formatDeltaPP(
              current -
                item.values[
                  index - 1
                ]
            )})`;
          }

          page.drawText(
            value.slice(
              0,
              22
            ),
            {
              x:
                xCum[
                  index + 1
                ],
              y,
              size: 7,
              font:
                regular,
              color:
                navy,
            }
          );
        }
      );

      y -= 21;
    }

    /*
     * =====================================================
     * TRIMESTRI PURI
     * =====================================================
     */

    y -= 10;

    section(
      "PERFORMANCE TRIMESTRALE"
    );

   text(
  "Valori economici del singolo trimestre ottenuti per differenza tra situazioni cumulative.",
  MARGIN,
  8,
  false,
  gray
);

text(
  "Valori espressi in euro.",
  MARGIN,
  8,
  false,
  gray
);

y -= 5;

    tableHeader(
      [
        "Indicatore",
        "Q1",
        "Q2",
        "Q3",
        "Q4",
      ],
      xCum
    );

    const pureRows =
      [
        {
          label:
            "Ricavi",
          values:
            ricaviPuri,
          format:
            euro,
        },
        {
          label:
            "Costi operativi",
          values:
            costiPuri,
          format:
            euro,
        },
        {
          label:
            "EBITDA",
          values:
            ebitdaPuro,
          format:
            euro,
        },
        {
          label:
            "EBIT",
          values:
            ebitPuro,
          format:
            euro,
        },
        {
          label:
            "Risultato netto",
          values:
            risultatoPuro,
          format:
            euro,
        },
        {
          label:
            "EBITDA margin",
          values:
            margineEbitdaPuro,
          format:
            percent,
        },
        {
          label:
            "Margine netto",
          values:
            margineNettoPuro,
          format:
            percent,
        },
      ];

    pureRows.forEach(
      (item) => {
        ensure(25);

        page.drawText(
          item.label,
          {
            x:
              xCum[0],
            y,
            size: 8,
            font: bold,
            color: navy,
          }
        );

        item.values.forEach(
          (
            value,
            index
          ) => {
            page.drawText(
              item
                .format(
                  value
                )
                .slice(
                  0,
                  20
                ),
              {
                x:
                  xCum[
                    index + 1
                  ],
                y,
                size: 7,
                font:
                  regular,
                color:
                  navy,
              }
            );
          }
        );

        y -= 21;
      }
    );

    /*
     * =====================================================
     * SINTESI GESTIONALE AUTOMATICA
     * =====================================================
     */

    newPage();

    text(
      "SINTESI GESTIONALE",
      MARGIN,
      15,
      true,
      navy
    );

    line();

    const last =
      elaborati.length -
      1;

    const previous =
      last - 1;

    if (previous >= 0) {
      const crescitaRicavi =
        deltaPercent(
          ricaviPuri[last],
          ricaviPuri[
            previous
          ]
        );

      const deltaMargin =
        margineEbitdaPuro[
          last
        ] -
        margineEbitdaPuro[
          previous
        ];

      const deltaRoi =
        n(
          elaborati[last]
            .indici.roi
        ) -
        n(
          elaborati[
            previous
          ].indici.roi
        );

      /*
       * RICAVI
       */

      text(
        "Andamento dei ricavi",
        MARGIN,
        11,
        true
      );

      text(
        `L'ultimo trimestre presenta ricavi per ${euro(
          ricaviPuri[last]
        )}, con una variazione del ${formatDeltaPercent(
          crescitaRicavi
        )} rispetto al trimestre precedente.`,
        MARGIN,
        9,
        false,
        crescitaRicavi !==
          null &&
        crescitaRicavi >= 0
          ? green
          : red
      );

      y -= 8;

      /*
       * EBITDA
       */

      text(
        "Marginalita operativa",
        MARGIN,
        11,
        true
      );

      text(
        `L'EBITDA margin dell'ultimo trimestre e pari al ${percent(
          margineEbitdaPuro[
            last
          ]
        )}, con uno scostamento di ${formatDeltaPP(
          deltaMargin
        )} rispetto al trimestre precedente.`,
        MARGIN,
        9,
        false,
        deltaMargin >= 0
          ? green
          : red
      );

      y -= 8;

      /*
       * RISULTATO
       */

      text(
        "Risultato economico",
        MARGIN,
        11,
        true
      );

      text(
        `Il risultato economico del solo ultimo trimestre e pari a ${euro(
          risultatoPuro[
            last
          ]
        )}.`,
        MARGIN,
        9,
        false,
        risultatoPuro[
          last
        ] >= 0
          ? green
          : red
      );

      if (
        risultatoPuro[
          last
        ] < 0
      ) {
        text(
          "L'ultimo trimestre ha assorbito una parte del risultato positivo maturato nei periodi precedenti e richiede approfondimento.",
          MARGIN,
          9,
          true,
          red
        );
      }

      y -= 8;

      /*
       * ROI
       */

      text(
        "Redditivita del capitale",
        MARGIN,
        11,
        true
      );

      text(
        `Il ROI si attesta al ${percent(
          elaborati[last]
            .indici.roi
        )}, con una variazione di ${formatDeltaPP(
          deltaRoi
        )} rispetto al periodo precedente.`,
        MARGIN,
        9,
        false,
        deltaRoi >= 0
          ? green
          : red
      );
    }

    /*
     * =====================================================
     * STATO PATRIMONIALE FINALE
     * =====================================================
     */

    section(
      "STRUTTURA PATRIMONIALE E FINANZIARIA"
    );

    row(
      "Totale attivo",
      euro(
        ultimoIndici
          .totale_attivo
      )
    );

    row(
      "Attivo corrente",
      euro(
        ultimoIndici
          .attivo_corrente
      )
    );

    row(
      "Patrimonio netto",
      euro(
        ultimoIndici
          .patrimonio_netto
      ),
      true
    );

    row(
      "Passivo corrente",
      euro(
        ultimoIndici
          .passivo_corrente
      )
    );

    row(
      "Debiti totali",
      euro(
        ultimoIndici
          .debiti_totali
      )
    );

    row(
      "Indice indebitamento",
      numero(
        ultimoIndici
          .indebitamento
      )
    );

    row(
      "Indice liquidita",
      numero(
        ultimoIndici
          .liquidita
      )
    );

    if (
      ultimoIndici.dscr !==
        null &&
      ultimoIndici.dscr !==
        undefined
    ) {
      row(
        "DSCR",
        numero(
          ultimoIndici.dscr
        )
      );
    }

     const pages =
      pdf.getPages();

    pages.forEach(
      (
        p,
        index
      ) => {
        p.drawLine({
          start: {
            x: MARGIN,
            y: 35,
          },
          end: {
            x:
              PAGE_W -
              MARGIN,
            y: 35,
          },
          thickness:
            0.4,
          color:
            lightGray,
        });

        p.drawText(
          "Studio Manager Pro - Controllo di gestione",
          {
            x: MARGIN,
            y: 20,
            size: 7,
            font: regular,
            color: gray,
          }
        );

        p.drawText(
          `Pagina ${
            index + 1
          } / ${pages.length}`,
          {
            x: 485,
            y: 20,
            size: 7,
            font: regular,
            color: gray,
          }
        );
      }
    );

    const bytes =
      await pdf.save();

    return new NextResponse(
      Buffer.from(bytes),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `inline; filename="controllo-gestione-${anno}-${clienteId}.pdf"`,
        },
      }
    );
  } catch (error: any) {
    console.error(
      "Errore report controllo gestione:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Errore generazione report",
      },
      {
        status: 500,
      }
    );
  }
}

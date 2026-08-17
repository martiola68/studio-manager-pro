import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatDateIT(value?: string | null) {
  if (!value) return "-";

  return new Date(
    `${value}T00:00:00`
  ).toLocaleDateString("it-IT");
}

function tipoLabel(tipo?: string | null) {
  const map: Record<string, string> = {
    REVISIONE_LEGALE: "Revisione legale",
    SOCIETA_REVISIONE: "Società di revisione",
    SINDACO_UNICO: "Sindaco unico",
    COLLEGIO_SINDACALE: "Collegio sindacale",
    ORGANO_UNICO_DOPPIA_FUNZIONE:
      "Organo unico doppia funzione",
    SINDACO_COLLEGIO_PIU_REVISORE:
      "Sindaco/Collegio + Revisore",
  };

  return tipo ? map[tipo] || tipo : "";
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function bodyParagraph(
  text: string,
  options?: {
    bold?: boolean;
    spacingAfter?: number;
   alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  }
) {
  return new Paragraph({
    alignment:
      options?.alignment ||
      AlignmentType.JUSTIFIED,

    spacing: {
      after:
        options?.spacingAfter ??
        160,

      line: 276,
    },

    children: [
      new TextRun({
        text,
        bold:
          options?.bold ||
          false,

        font:
          "Times New Roman",

        size: 24,
      }),
    ],
  });
}

function headingParagraph(
  text: string
) {
  return new Paragraph({
    spacing: {
      before: 240,
      after: 140,
    },

    children: [
      new TextRun({
        text,
        bold: true,
        font:
          "Times New Roman",
        size: 26,
      }),
    ],
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error:
          "Metodo non consentito",
      });
    }

    const {
      controllo_id,
      relazione_id,
      testo_generato,
    } = req.body;

    if (!controllo_id) {
      return res.status(400).json({
        success: false,
        error:
          "controllo_id obbligatorio",
      });
    }

    /*
     * =====================================================
     * CONTROLLO
     * =====================================================
     */
    const {
      data: controllo,
      error: controlloError,
    } =
      await supabaseAdmin
        .from(
          "vw_revisione_controlli"
        )
        .select("*")
        .eq(
          "id",
          controllo_id
        )
        .single();

    if (controlloError) {
      throw controlloError;
    }

    /*
     * =====================================================
     * CLIENTE
     * =====================================================
     */
    const {
      data: cliente,
      error: clienteError,
    } =
      await supabaseAdmin
        .from("tbclienti")
        .select(`
          ragione_sociale,
          codice_fiscale,
          partita_iva,
          indirizzo,
          cap,
          citta,
          provincia
        `)
        .eq(
          "id",
          controllo.cliente_id
        )
        .single();

    if (clienteError) {
      throw clienteError;
    }

    /*
     * =====================================================
     * SOGGETTI
     * =====================================================
     */
    const {
      data: soggetti,
      error: soggettiError,
    } =
      await supabaseAdmin
        .from(
          "tbrevisione_soggetti"
        )
        .select("*")
        .eq(
          "incarico_id",
          controllo.incarico_id
        )
        .eq(
          "attivo",
          true
        );

    if (soggettiError) {
      throw soggettiError;
    }

    /*
     * =====================================================
     * CHECKLIST
     * =====================================================
     */
    const {
      data: checklist,
      error: checklistError,
    } =
      await supabaseAdmin
        .from(
          "tbrevisione_checklist"
        )
        .select("*")
        .eq(
          "controllo_id",
          controllo_id
        )
        .order(
          "area",
          {
            ascending: true,
          }
        )
        .order(
          "ordine",
          {
            ascending: true,
          }
        );

    if (checklistError) {
      throw checklistError;
    }

    /*
     * =====================================================
     * RELAZIONE SALVATA
     * =====================================================
     */
    let testoRelazione =
      String(
        testo_generato || ""
      ).trim();

    if (
      !testoRelazione &&
      relazione_id
    ) {
      const {
        data: relazione,
        error: relazioneError,
      } =
        await supabaseAdmin
          .from(
            "tbrevisione_relazioni"
          )
          .select(
            "testo_generato"
          )
          .eq(
            "id",
            relazione_id
          )
          .single();

      if (relazioneError) {
        throw relazioneError;
      }

      testoRelazione =
        relazione
          ?.testo_generato ||
        "";
    }

    /*
     * =====================================================
     * DATI GENERALI
     * =====================================================
     */

    const sede = [
      cliente?.indirizzo,
      cliente?.cap,
      cliente?.citta,
      cliente?.provincia,
    ]
      .filter(Boolean)
      .join(" ");

    const revisori =
      (soggetti || [])
        .filter(
          (s: any) =>
            s.ruolo ===
              "REVISORE" ||
            s.ruolo ===
              "SOCIETA_REVISIONE"
        )
        .map(
          (s: any) =>
            s.nome
        )
        .join(", ");

    const sindacoUnico =
      (soggetti || [])
        .filter(
          (s: any) =>
            s.ruolo ===
            "SINDACO_UNICO"
        )
        .map(
          (s: any) =>
            s.nome
        )
        .join(", ");

    const presidenteCollegio =
      (soggetti || [])
        .filter(
          (s: any) =>
            s.ruolo ===
            "PRESIDENTE_COLLEGIO"
        )
        .map(
          (s: any) =>
            s.nome
        )
        .join(", ");

    const sindaciEffettivi =
      (soggetti || [])
        .filter(
          (s: any) =>
            s.ruolo ===
            "SINDACO_EFFETTIVO"
        )
        .map(
          (s: any) =>
            s.nome
        )
        .join(", ");

    /*
     * =====================================================
     * COSTRUZIONE WORD
     * =====================================================
     */

    const paragraphs:
      Paragraph[] = [];

    /*
     * TITOLO
     */
    paragraphs.push(
      new Paragraph({
        alignment:
          AlignmentType.CENTER,

        spacing: {
          after: 200,
        },

        children: [
          new TextRun({
            text:
              "RELAZIONE / VERBALE DI CONTROLLO PERIODICO",
            bold: true,
            font:
              "Times New Roman",
            size: 30,
          }),
        ],
      })
    );

    paragraphs.push(
      new Paragraph({
        alignment:
          AlignmentType.CENTER,

        spacing: {
          after: 360,
        },

        children: [
          new TextRun({
            text:
              `${controllo.trimestre}° trimestre ${controllo.anno}`,
            bold: true,
            font:
              "Times New Roman",
            size: 26,
          }),
        ],
      })
    );

    /*
     * DATI SOCIETÀ
     */
    paragraphs.push(
      headingParagraph(
        "Dati della società"
      )
    );

    paragraphs.push(
      bodyParagraph(
        `Società: ${
          cliente?.ragione_sociale ||
          controllo.ragione_sociale ||
          "-"
        }`
      )
    );

    paragraphs.push(
      bodyParagraph(
        `Codice fiscale: ${
          cliente?.codice_fiscale ||
          "-"
        }`
      )
    );

    paragraphs.push(
      bodyParagraph(
        `Partita IVA: ${
          cliente?.partita_iva ||
          "-"
        }`
      )
    );

    paragraphs.push(
      bodyParagraph(
        `Sede: ${sede || "-"}`
      )
    );

    /*
     * INCARICO
     */
    paragraphs.push(
      headingParagraph(
        "Dati dell'incarico"
      )
    );

    paragraphs.push(
      bodyParagraph(
        `Tipo di incarico: ${tipoLabel(
          controllo.tipo_incarico
        )}`
      )
    );

    paragraphs.push(
      bodyParagraph(
        `Periodo verificato: ${controllo.trimestre}° trimestre ${controllo.anno}`
      )
    );

    paragraphs.push(
      bodyParagraph(
        `Data del controllo: ${formatDateIT(
          controllo.data_controllo
        )}`
      )
    );

    if (revisori) {
      paragraphs.push(
        bodyParagraph(
          `Revisore: ${revisori}`
        )
      );
    }

    if (sindacoUnico) {
      paragraphs.push(
        bodyParagraph(
          `Sindaco unico: ${sindacoUnico}`
        )
      );
    }

    if (
      presidenteCollegio
    ) {
      paragraphs.push(
        bodyParagraph(
          `Presidente del Collegio Sindacale: ${presidenteCollegio}`
        )
      );
    }

    if (
      sindaciEffettivi
    ) {
      paragraphs.push(
        bodyParagraph(
          `Sindaci effettivi: ${sindaciEffettivi}`
        )
      );
    }

    /*
     * TESTO GENERATO DAL MODELLO
     */
    if (testoRelazione) {
      paragraphs.push(
        headingParagraph(
          "Relazione"
        )
      );

      const blocchi =
        testoRelazione
          .split(/\n+/)
          .map(
            (x: string) =>
              x.trim()
          )
          .filter(Boolean);

      for (
        const blocco of blocchi
      ) {
        paragraphs.push(
          bodyParagraph(
            blocco
          )
        );
      }
    }

    /*
     * CHECKLIST PER AREA
     */
    if (
      checklist &&
      checklist.length > 0
    ) {
      paragraphs.push(
        headingParagraph(
          "Riepilogo delle verifiche effettuate"
        )
      );

      const aree =
        Array.from(
          new Set(
            checklist.map(
              (item: any) =>
                item.area
            )
          )
        );

      for (
        const area of aree
      ) {
        paragraphs.push(
          new Paragraph({
            spacing: {
              before: 260,
              after: 150,
            },

            children: [
              new TextRun({
                text:
                  String(area),
                bold: true,
                font:
                  "Times New Roman",
                size: 25,
              }),
            ],
          })
        );

        const itemsArea =
          checklist.filter(
            (item: any) =>
              item.area === area
          );

        for (
          const item of itemsArea
        ) {
          paragraphs.push(
            bodyParagraph(
              item.domanda,
              {
                bold: true,
                spacingAfter: 80,
              }
            )
          );

          paragraphs.push(
            bodyParagraph(
              `Risposta: ${
                item.risposta ||
                "Non compilato"
              }`,
              {
                spacingAfter: 50,
              }
            )
          );

          paragraphs.push(
            bodyParagraph(
              `Esito: ${
                item.esito ||
                "-"
              }`,
              {
                spacingAfter: 50,
              }
            )
          );

          if (
            item.procedura
          ) {
            paragraphs.push(
              bodyParagraph(
                `Procedura eseguita: ${item.procedura}`,
                {
                  spacingAfter:
                    50,
                }
              )
            );
          }

          if (
            item.gravita
          ) {
            paragraphs.push(
              bodyParagraph(
                `Gravità: ${item.gravita}`,
                {
                  spacingAfter:
                    50,
                }
              )
            );
          }

          if (
            item.significativita
          ) {
            paragraphs.push(
              bodyParagraph(
                `Significatività: ${item.significativita}`,
                {
                  spacingAfter:
                    50,
                }
              )
            );
          }

          if (
            item.raccomandazione
          ) {
            paragraphs.push(
              bodyParagraph(
                `Raccomandazione: ${item.raccomandazione}`,
                {
                  spacingAfter:
                    50,
                }
              )
            );
          }

          if (item.note) {
            paragraphs.push(
              bodyParagraph(
                `Note: ${item.note}`,
                {
                  spacingAfter:
                    120,
                }
              )
            );
          }

          paragraphs.push(
            new Paragraph({
              spacing: {
                after: 120,
              },

              children: [
                new TextRun({
                  text:
                    " ",
                  font:
                    "Times New Roman",
                  size: 24,
                }),
              ],
            })
          );
        }
      }
    }

    /*
     * CONCLUSIONI
     */
    paragraphs.push(
      headingParagraph(
        "Conclusioni"
      )
    );

    paragraphs.push(
      bodyParagraph(
        controllo.esito
          ? `Esito complessivo del controllo: ${controllo.esito}.`
          : "Le conclusioni del controllo devono essere completate sulla base delle procedure eseguite e delle evidenze raccolte."
      )
    );

    if (
      controllo.note
    ) {
      paragraphs.push(
        bodyParagraph(
          controllo.note
        )
      );
    }

    /*
     * FIRMA
     */
    paragraphs.push(
      new Paragraph({
        spacing: {
          before: 500,
          after: 120,
        },

        alignment:
          AlignmentType.RIGHT,

        children: [
          new TextRun({
            text:
              "Il professionista incaricato",
            font:
              "Times New Roman",
            size: 24,
          }),
        ],
      })
    );

    const nomeFirma =
      revisori ||
      sindacoUnico ||
      presidenteCollegio ||
      "";

    if (nomeFirma) {
      paragraphs.push(
        new Paragraph({
          alignment:
            AlignmentType.RIGHT,

          children: [
            new TextRun({
              text:
                nomeFirma,
              bold: true,
              font:
                "Times New Roman",
              size: 24,
            }),
          ],
        })
      );
    }

    /*
     * =====================================================
     * DOCUMENTO
     * =====================================================
     */

    const doc =
      new Document({
        styles: {
          default: {
            document: {
              run: {
                font:
                  "Times New Roman",
                size: 24,
              },

              paragraph: {
                spacing: {
                  line: 276,
                  after: 160,
                },
              },
            },
          },
        },

        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440,
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },

            footers: {
              default:
                new Footer({
                  children: [
                    new Paragraph({
                      alignment:
                        AlignmentType.CENTER,

                      children: [
                        new TextRun({
                          text:
                            "Studio Manager Pro - Revisione e Controllo   |   Pagina ",
                          font:
                            "Times New Roman",
                          size: 18,
                        }),

                        new TextRun({
                          children: [
                            PageNumber.CURRENT,
                          ],
                          font:
                            "Times New Roman",
                          size: 18,
                        }),
                      ],
                    }),
                  ],
                }),
            },

            children:
              paragraphs,
          },
        ],
      });

    const buffer =
      await Packer.toBuffer(
        doc
      );

    const nomeCliente =
      safeFileName(
        cliente?.ragione_sociale ||
          controllo.ragione_sociale ||
          "cliente"
      );

    const nomeFile =
      `Relazione_${nomeCliente}_${controllo.anno}_Q${controllo.trimestre}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeFile}"`
    );

    res.setHeader(
      "Content-Length",
      buffer.length
    );

    return res
      .status(200)
      .send(buffer);
  } catch (error: any) {
    console.error(
      "Errore genera DOCX revisione:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        error:
          error?.message ||
          "Errore generazione Word",
      });
  }
}

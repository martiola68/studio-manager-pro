'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Utente = {
  id: string;
  studio_id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  tipo_rapporto: string | null;
  responsabile_paghe: boolean | null;
  attivo: boolean | null;
};

type CodicePresenza = {
  codice: string;
  descrizione: string | null;
  tipo: string | null;
  ordine: number | null;
  attivo: boolean | null;
};

type Festivita = {
  data_festivita: string;
  descrizione: string | null;
  tipo: 'nazionale' | 'locale' | 'aziendale' | string | null;
};

type Presenza = {
  id?: string;
  studio_id: string;
  utente_id: string;
  data_presenza: string;
  codice_presenza: string;
  note?: string | null;
  inserito_da?: string | null;
};

type DayInfo = {
  date: string;
  day: number;
  weekday: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayDescription?: string;
};

type RowSummary = {
  pp: number;
  ps: number;
  ferie: number;
  malattia: number;
  festivi: number;
  permessiOre: number;
};

type LooseSupabaseClient = {
  auth: ReturnType<typeof getSupabaseClient>['auth'];
  from: (table: string) => any;
};

function getBrowserSupabaseClient() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client disponibile solo nel browser.');
  }

  return getSupabaseClient() as unknown as LooseSupabaseClient;
}

const DEFAULT_WORKDAY_CODE = 'Pp';
const DEFAULT_NON_WORKDAY_CODE = 'N';

const MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const PRESENCE_COLORS: Record<string, string> = {
  N: 'bg-gray-100 text-gray-700 border-gray-200',
  F: 'bg-sky-100 text-sky-800 border-sky-200',
  M: 'bg-red-100 text-red-800 border-red-200',
  Pp: 'bg-green-100 text-green-800 border-green-200',
  Ps: 'bg-violet-100 text-violet-800 border-violet-200',
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getEmployeeName(user: Utente) {
  const fullName = `${user.cognome ?? ''} ${user.nome ?? ''}`.trim();
  return fullName || user.email || 'Dipendente';
}

function getCellClass(code: string) {
  if (/^P[1-8]$/.test(code)) return 'bg-orange-100 text-orange-800 border-orange-200';
  return PRESENCE_COLORS[code] ?? 'bg-white text-gray-800 border-gray-200';
}

function getDefaultCode(day: DayInfo) {
  return day.isWeekend || day.isHoliday ? DEFAULT_NON_WORKDAY_CODE : DEFAULT_WORKDAY_CODE;
}

function summarize(codes: string[]): RowSummary {
  return codes.reduce<RowSummary>(
    (acc, code) => {
      if (code === 'Pp') acc.pp += 1;
      if (code === 'Ps') acc.ps += 1;
      if (code === 'F') acc.ferie += 1;
      if (code === 'M') acc.malattia += 1;
      if (code === 'N') acc.festivi += 1;
      if (/^P[1-8]$/.test(code)) acc.permessiOre += Number(code.replace('P', ''));
      return acc;
    },
    { pp: 0, ps: 0, ferie: 0, malattia: 0, festivi: 0, permessiOre: 0 },
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const safeValue = String(value ?? '');
          return `"${safeValue.replace(/"/g, '""')}"`;
        })
        .join(';'),
    )
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PresenzePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());

  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [codici, setCodici] = useState<CodicePresenza[]>([]);
  const [festivita, setFestivita] = useState<Festivita[]>([]);
  const [dipendenti, setDipendenti] = useState<Utente[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startDate = useMemo(() => toDateKey(year, monthIndex, 1), [year, monthIndex]);
  const endDate = useMemo(
    () => toDateKey(year, monthIndex, getDaysInMonth(year, monthIndex)),
    [year, monthIndex],
  );

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Festivita>();
    festivita.forEach((item) => map.set(item.data_festivita, item));
    return map;
  }, [festivita]);

  const days = useMemo<DayInfo[]>(() => {
    const totalDays = getDaysInMonth(year, monthIndex);
    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const date = toDateKey(year, monthIndex, day);
      const weekday = new Date(year, monthIndex, day).getDay();
      const holiday = holidaysByDate.get(date);
      return {
        date,
        day,
        weekday,
        isWeekend: weekday === 0 || weekday === 6,
        isHoliday: Boolean(holiday),
        holidayDescription: holiday?.descrizione ?? undefined,
      };
    });
  }, [year, monthIndex, holidaysByDate]);

  const allowedCodes = useMemo(() => {
    const withoutOldP = codici.filter((item) => item.codice !== 'P');
    const requiredOrder = ['Pp', 'Ps', 'F', 'M', 'N', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    return [...withoutOldP].sort((a, b) => {
      const ai = requiredOrder.indexOf(a.codice);
      const bi = requiredOrder.indexOf(b.codice);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return (a.ordine ?? 999) - (b.ordine ?? 999) || a.codice.localeCompare(b.codice);
    });
  }, [codici]);

  const isResponsabilePaghe = Boolean(currentUser?.responsabile_paghe);

  const loadData = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const supabase = getBrowserSupabaseClient();

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const email = sessionData.session?.user?.email;
      if (!email) throw new Error('Sessione non trovata. Effettua nuovamente il login.');

      const userQuery = supabase
        .from('tbutenti')
        .select('id, studio_id, nome, cognome, email, tipo_rapporto, responsabile_paghe, attivo')
        .eq('email', email)
        .eq('attivo', true)
        .single();

      const { data: user, error: userError } = (await userQuery) as unknown as {
        data: Utente | null;
        error: Error | null;
      };

      if (userError) throw userError;
      if (!user) throw new Error('Utente non trovato in tbutenti.');

      const typedUser = user;
      if (typedUser.tipo_rapporto !== 'Dipendente') {
        throw new Error('Il modulo presenze è disponibile solo per utenti con rapporto Dipendente.');
      }

      setCurrentUser(typedUser);

      const codiciQuery = supabase
        .from('tbpresenze_codici')
        .select('codice, descrizione, tipo, ordine, attivo')
        .eq('attivo', true)
        .order('ordine', { ascending: true });

      const festivitaQuery = supabase
        .from('tbfestivita')
        .select('data_festivita, descrizione, tipo')
        .gte('data_festivita', startDate)
        .lte('data_festivita', endDate)
        .in('tipo', ['nazionale', 'aziendale']);

      const dipendentiQuery = typedUser.responsabile_paghe
        ? supabase
            .from('tbutenti')
            .select('id, studio_id, nome, cognome, email, tipo_rapporto, responsabile_paghe, attivo')
            .eq('studio_id', typedUser.studio_id)
            .eq('tipo_rapporto', 'Dipendente')
            .eq('attivo', true)
            .order('cognome', { ascending: true })
            .order('nome', { ascending: true })
        : supabase
            .from('tbutenti')
            .select('id, studio_id, nome, cognome, email, tipo_rapporto, responsabile_paghe, attivo')
            .eq('id', typedUser.id);

      const [codiciResult, festivitaResult, dipendentiResult] = (await Promise.all([
        codiciQuery,
        festivitaQuery,
        dipendentiQuery,
      ])) as unknown as [
        { data: CodicePresenza[] | null; error: Error | null },
        { data: Festivita[] | null; error: Error | null },
        { data: Utente[] | null; error: Error | null },
      ];

      if (codiciResult.error) throw codiciResult.error;
      if (festivitaResult.error) throw festivitaResult.error;
      if (dipendentiResult.error) throw dipendentiResult.error;

      const loadedDipendenti = (dipendentiResult.data ?? []) as Utente[];
      setCodici((codiciResult.data ?? []) as CodicePresenza[]);
      setFestivita((festivitaResult.data ?? []) as Festivita[]);
      setDipendenti(loadedDipendenti);

      const employeeIds = loadedDipendenti.map((item) => item.id);
      if (employeeIds.length === 0) {
        setValues({});
        return;
      }

      const { data: presenzeData, error: presenzeError } = await supabase
        .from('tbpresenze_dipendenti')
        .select('id, studio_id, utente_id, data_presenza, codice_presenza, note, inserito_da')
        .eq('studio_id', typedUser.studio_id)
        .gte('data_presenza', startDate)
        .lte('data_presenza', endDate)
        .in('utente_id', employeeIds);

      if (presenzeError) throw presenzeError;

      const loadedValues: Record<string, string> = {};
      (presenzeData ?? []).forEach((presence: Presenza) => {
        loadedValues[`${presence.utente_id}|${presence.data_presenza}`] = presence.codice_presenza;
      });

      loadedDipendenti.forEach((dipendente) => {
        days.forEach((day) => {
          const key = `${dipendente.id}|${day.date}`;
          if (!loadedValues[key]) loadedValues[key] = getDefaultCode(day);
        });
      });

      setValues(loadedValues);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il caricamento delle presenze.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [days, endDate, startDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (utenteId: string, date: string, code: string) => {
    setSuccess(null);
    setValues((prev) => ({ ...prev, [`${utenteId}|${date}`]: code }));
  };

  const getCode = (utenteId: string, day: DayInfo) => {
    return values[`${utenteId}|${day.date}`] ?? getDefaultCode(day);
  };

  const getSummaryForEmployee = (utenteId: string) => {
    return summarize(days.map((day) => getCode(utenteId, day)));
  };

  const saveMonth = async () => {
    if (!currentUser) return;

    const supabase = getBrowserSupabaseClient();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const rows = dipendenti.flatMap((dipendente) =>
        days.map((day) => ({
          studio_id: currentUser.studio_id,
          utente_id: dipendente.id,
          data_presenza: day.date,
          codice_presenza: getCode(dipendente.id, day),
          inserito_da: currentUser.id,
          updated_at: new Date().toISOString(),
        })),
      );

      const { error: upsertError } = await supabase
        .from('tbpresenze_dipendenti')
        .upsert(rows, { onConflict: 'utente_id,data_presenza' });

      if (upsertError) throw upsertError;

      setSuccess('Presenze del mese salvate correttamente.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il salvataggio delle presenze.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const header = [
      'Dipendente',
      'Email',
      ...days.map((day) => `${day.day}`),
      'Giorni Pp',
      'Giorni Ps',
      'Ferie',
      'Malattia',
      'Festivi',
      'Permessi ore',
    ];

    const rows = dipendenti.map((dipendente) => {
      const summary = getSummaryForEmployee(dipendente.id);
      return [
        getEmployeeName(dipendente),
        dipendente.email ?? '',
        ...days.map((day) => getCode(dipendente.id, day)),
        String(summary.pp),
        String(summary.ps),
        String(summary.ferie),
        String(summary.malattia),
        String(summary.festivi),
        String(summary.permessiOre),
      ];
    });

    downloadCsv(`presenze_${year}_${pad2(monthIndex + 1)}.csv`, [header, ...rows]);
  };

  return (
    <>
      <Head>
        <title>Presenze dipendenti</title>
      </Head>

      <div className="mx-auto flex max-w-[1800px] flex-col gap-4 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Presenze dipendenti</h1>
            <p className="text-sm text-muted-foreground">
              Riepilogo operativo mensile per payroll, senza gestione saldi ferie o permessi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isResponsabilePaghe ? (
              <Badge variant="secondary">Responsabile paghe</Badge>
            ) : (
              <Badge variant="outline">Vista dipendente</Badge>
            )}
            <Button variant="outline" onClick={loadData} disabled={loading || saving}>
              Aggiorna
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={loading || dipendenti.length === 0}>
              Export CSV
            </Button>
            <Button onClick={saveMonth} disabled={loading || saving || dipendenti.length === 0}>
              {saving ? 'Salvataggio...' : 'Salva mese'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Mese</label>
                <Select value={String(monthIndex)} onValueChange={(value) => setMonthIndex(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona mese" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={month} value={String(index)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[120px]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Anno</label>
                <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Anno" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 7 }, (_, index) => now.getFullYear() - 3 + index).map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge className="border bg-green-100 text-green-800 hover:bg-green-100">Pp ufficio</Badge>
                <Badge className="border bg-violet-100 text-violet-800 hover:bg-violet-100">Ps smart</Badge>
                <Badge className="border bg-sky-100 text-sky-800 hover:bg-sky-100">F ferie</Badge>
                <Badge className="border bg-red-100 text-red-800 hover:bg-red-100">M malattia</Badge>
                <Badge className="border bg-gray-100 text-gray-700 hover:bg-gray-100">N non lavorativo</Badge>
                <Badge className="border bg-orange-100 text-orange-800 hover:bg-orange-100">P1-P8 permessi</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {success}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {MONTHS[monthIndex]} {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Caricamento presenze...</div>
            ) : dipendenti.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nessun dipendente trovato.</div>
            ) : (
              <div className="w-full overflow-x-auto rounded-md border">
                <Table className="min-w-max text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-20 w-[220px] bg-background shadow-sm">
                        Dipendente
                      </TableHead>
                      {days.map((day) => (
                        <TableHead
                          key={day.date}
                          title={day.holidayDescription}
                          className={`w-[72px] text-center ${
                            day.isWeekend || day.isHoliday ? 'bg-gray-50 text-gray-500' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center leading-tight">
                            <span>{day.day}</span>
                            {day.isHoliday && <span className="text-[10px]">fest.</span>}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="w-[60px] text-center">Pp</TableHead>
                      <TableHead className="w-[60px] text-center">Ps</TableHead>
                      <TableHead className="w-[60px] text-center">F</TableHead>
                      <TableHead className="w-[60px] text-center">M</TableHead>
                      <TableHead className="w-[60px] text-center">N</TableHead>
                      <TableHead className="w-[80px] text-center">Perm.</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {dipendenti.map((dipendente) => {
                      const summary = getSummaryForEmployee(dipendente.id);

                      return (
                        <TableRow key={dipendente.id}>
                          <TableCell className="sticky left-0 z-10 bg-background font-medium shadow-sm">
                            <div className="flex flex-col">
                              <span>{getEmployeeName(dipendente)}</span>
                              <span className="text-[11px] font-normal text-muted-foreground">
                                {dipendente.email}
                              </span>
                            </div>
                          </TableCell>

                          {days.map((day) => {
                            const code = getCode(dipendente.id, day);
                            return (
                              <TableCell key={`${dipendente.id}-${day.date}`} className="p-1 text-center">
                                <Select
                                  value={code}
                                  onValueChange={(value) => handleChange(dipendente.id, day.date, value)}
                                >
                                  <SelectTrigger
                                    className={`h-8 w-[64px] border px-2 text-xs ${getCellClass(code)}`}
                                    title={day.holidayDescription}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allowedCodes.map((item) => (
                                      <SelectItem key={item.codice} value={item.codice}>
                                        {item.codice} - {item.descrizione ?? ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            );
                          })}

                          <TableCell className="text-center font-medium">{summary.pp}</TableCell>
                          <TableCell className="text-center font-medium">{summary.ps}</TableCell>
                          <TableCell className="text-center font-medium">{summary.ferie}</TableCell>
                          <TableCell className="text-center font-medium">{summary.malattia}</TableCell>
                          <TableCell className="text-center font-medium">{summary.festivi}</TableCell>
                          <TableCell className="text-center font-medium">{summary.permessiOre}h</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

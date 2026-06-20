'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { sendEmail } from '@/services/emailService';


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

type Dipendente = {
  id: string;
  studio_id: string;
  utente_id: string;
  codice_ditta: string | null;
  codice_dipendente: string | null;
  codice_soggetto_paghe: string | null;
  numero_rapporto_paghe: string | null;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  orario_giornaliero: number | null;
  data_cessazione: string | null;
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

  richiesta_ferie_permessi_id?: string | null;
  generata_da_richiesta_ferie_permessi?: boolean | null;
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
  permessi104Ore: number;
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

const DEFAULT_NON_WORKDAY_CODE = 'N';

const MIN_YEAR = 2026;
const MIN_MONTH_INDEX = 3; // Aprile

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

const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

const PRESENCE_COLORS: Record<string, string> = {
  N: 'bg-gray-100 text-gray-700 border-gray-200',
  F: 'bg-sky-100 text-sky-800 border-sky-200',
  M: 'bg-red-100 text-red-800 border-red-200',
  Pp: 'bg-green-100 text-green-800 border-green-200',
  Ps: 'bg-violet-100 text-violet-800 border-violet-200',
};


function Button({
  children,
  className = '',
  variant,
  disabled,
  ...props
}: any) {
  return (
    <button
      className={`rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'outline'
          ? 'bg-white hover:bg-gray-50'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Badge({ children, className = '', variant }: any) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        variant === 'outline' ? 'bg-white' : 'bg-gray-100'
      } ${className}`}
    >
      {children}
    </span>
  );
}

function Card({ children, className = '' }: any) {
  return (
    <div className={`rounded-lg border bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }: any) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

function CardTitle({ children, className = '' }: any) {
  return <h3 className={`font-semibold ${className}`}>{children}</h3>;
}

function CardContent({ children, className = '' }: any) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getEmployeeName(user: Utente | Dipendente) {
  const fullName = `${user.cognome ?? ''} ${user.nome ?? ''}`.trim();
  return fullName || user.email || 'Dipendente';
}

function isPermessoCode(code: string) {
  return /^P\d+(\.\d+)?$/.test(code);
}

function isPermesso104Code(code: string) {
  return /^P\d+(\.\d+)?\.104$/.test(code);
}

function getPermessoHours(code: string) {
  return Number(code.replace('P', '').replace('.104', ''));
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function buildQuarterHourCodes(suffix = '') {
  const codes: string[] = [];

  for (let minutes = 15; minutes <= 8 * 60; minutes += 15) {
    const hours = minutes / 60;
    codes.push(`P${formatHours(hours)}${suffix}`);
  }

  return codes;
}

function getCellClass(code: string) {
  if (isPermesso104Code(code)) return 'bg-pink-100 text-pink-800 border-pink-200';
  if (isPermessoCode(code)) return 'bg-orange-100 text-orange-800 border-orange-200';
  return PRESENCE_COLORS[code] ?? 'bg-white text-gray-800 border-gray-200';
}

function getHolidayCellClass(code: string) {
  if (code === 'N') return 'bg-lime-300 text-lime-950 border-lime-500 font-semibold';
  return getCellClass(code);
}

function getTodayKey() {
  const today = new Date();
  return toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
}

function isBeforeEnabledPeriod(year: number, monthIndex: number) {
  return year < MIN_YEAR || (year === MIN_YEAR && monthIndex < MIN_MONTH_INDEX);
}

function summarize(codes: string[]): RowSummary {
  return codes.reduce<RowSummary>(
    (acc, code) => {
      if (code === 'Pp') acc.pp += 1;
      if (code === 'Ps') acc.ps += 1;
      if (code === 'F') acc.ferie += 1;
      if (code === 'M') acc.malattia += 1;
      if (code === 'N') acc.festivi += 1;
      if (isPermessoCode(code)) acc.permessiOre += getPermessoHours(code);
      if (isPermesso104Code(code)) acc.permessi104Ore += getPermessoHours(code);

      return acc;
    },
    {
      pp: 0,
      ps: 0,
      ferie: 0,
      malattia: 0,
      festivi: 0,
      permessiOre: 0,
      permessi104Ore: 0,
    },
  );
}

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPresenceHours(code: string, dailyHours: number) {
  if (code === 'Pp' || code === 'Ps' || code === 'F' || code === 'M') {
    return dailyHours;
  }

  if (code === 'AL1') return 1;
  if (code === 'AL2') return 2;

  if (isPermessoCode(code) || isPermesso104Code(code)) {
    return getPermessoHours(code);
  }

  return 0;
}

function getXmlGiustificativo(code: string) {
  if (code === 'Pp' || code === 'Ps') return '01';
  if (code === 'F') return 'FE';
  if (code === 'M') return 'MA';

  if (code === 'AL1' || code === 'AL2') return 'AL';

  if (isPermessoCode(code)) return 'RL';
  if (isPermesso104Code(code)) return 'PG';

  return null;
}

function splitHoursToOreMinuti(hours: number) {
  const safeHours = Math.max(0, hours || 0);
  const totalMinutes = Math.round(safeHours * 60);
  const ore = Math.floor(totalMinutes / 60);
  const minuti = totalMinutes % 60;
  const centesimi = Math.round((minuti / 60) * 100);

  return {
    ore,
    minuti,
    centesimi,
  };
}

function formatHoursMinutes(hours: number) {
  const { ore, minuti } = splitHoursToOreMinuti(hours);
  return `${ore}:${pad2(minuti)}h`;
}

function createXmlMovimento(date: string, giustificativo: string, hours: number) {
  const { ore, minuti, centesimi } = splitHoursToOreMinuti(hours);

  return `      <Movimento>
        <CodGiustificativoRilPres>${escapeXml(giustificativo)}</CodGiustificativoRilPres>
        <CodGiustificativoUfficiale>${escapeXml(giustificativo)}</CodGiustificativoUfficiale>
        <Data>${escapeXml(date)}</Data>
        <NumOre>${ore}</NumOre>
        <NumMinuti>${pad2(minuti)}</NumMinuti>
        <NumMinutiInCentesimi>${pad2(centesimi)}</NumMinutiInCentesimi>
        <GiornoDiRiposo>N</GiornoDiRiposo>
        <GiornoChiusuraStraordinari>N</GiornoChiusuraStraordinari>
      </Movimento>`;
}

function downloadXml(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
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

  const [modalSollecitiOpen, setModalSollecitiOpen] = useState(false);
  const [solleciti, setSolleciti] = useState<any[]>([]);
  const [sendingSolleciti, setSendingSolleciti] = useState(false);

  const [loadingSolleciti, setLoadingSolleciti] = useState(false);

  const [currentUser, setCurrentUser] = useState<Utente | null>(null);
  const [codici, setCodici] = useState<CodicePresenza[]>([]);
  const [festivita, setFestivita] = useState<Festivita[]>([]);
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [lockedCells, setLockedCells] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

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

    const quarterHourPermessi = buildQuarterHourCodes();
    const quarterHourPermessi104 = buildQuarterHourCodes('.104');

    const requiredOrder = [
      'Pp',
      'Ps',
      'F',
      'M',
      'N',
      ...quarterHourPermessi,
      ...quarterHourPermessi104,
    ];

    const generatedCodes: CodicePresenza[] = requiredOrder.map((codice, index) => ({
      codice,
      descrizione: null,
      tipo:
        codice.includes('.104')
          ? 'permesso_104'
          : codice.startsWith('P') && codice !== 'Pp' && codice !== 'Ps'
            ? 'permesso'
            : null,
      ordine: index,
      attivo: true,
    }));

    const mergedCodes = [
      ...generatedCodes,
      ...withoutOldP.filter(
        (item) => !generatedCodes.some((generated) => generated.codice === item.codice),
      ),
    ];

    return mergedCodes.sort((a, b) => {
      const ai = requiredOrder.indexOf(a.codice);
      const bi = requiredOrder.indexOf(b.codice);

      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }

      return (a.ordine ?? 999) - (b.ordine ?? 999) || a.codice.localeCompare(b.codice);
    });
  }, [codici]);

  const isResponsabilePaghe = Boolean(currentUser?.responsabile_paghe);
  const isLockedPeriod = isBeforeEnabledPeriod(year, monthIndex);

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

      const canAccessPresenze =
        typedUser.tipo_rapporto === 'Dipendente' || typedUser.responsabile_paghe === true;

      if (!canAccessPresenze) {
        setAccessDenied(true);
        setCurrentUser(typedUser);
        setDipendenti([]);
        setValues({});
        return;
      }

      setAccessDenied(false);
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
            .from('tbdipendenti')
            .select(`
              id,
              studio_id,
              utente_id,
              codice_ditta,
              codice_dipendente,
              codice_soggetto_paghe,
              numero_rapporto_paghe,
              nome,
              cognome,
              email,
              orario_giornaliero,
              data_cessazione,
              attivo
            `)
            .eq('studio_id', typedUser.studio_id)
            .eq('attivo', true)
            .order('cognome', { ascending: true })
            .order('nome', { ascending: true })
        : supabase
            .from('tbdipendenti')
            .select(`
              id,
              studio_id,
              utente_id,
              codice_ditta,
              codice_dipendente,
              codice_soggetto_paghe,
              numero_rapporto_paghe,
              nome,
              cognome,
              email,
              orario_giornaliero,
              data_cessazione,
              attivo
            `)
            .eq('studio_id', typedUser.studio_id)
            .eq('utente_id', typedUser.id)
            .eq('attivo', true);

      const [codiciResult, festivitaResult, dipendentiResult] = (await Promise.all([
        codiciQuery,
        festivitaQuery,
        dipendentiQuery,
      ])) as unknown as [
        { data: CodicePresenza[] | null; error: Error | null },
        { data: Festivita[] | null; error: Error | null },
        { data: Dipendente[] | null; error: Error | null },
      ];

      if (codiciResult.error) throw codiciResult.error;
      if (festivitaResult.error) throw festivitaResult.error;
      if (dipendentiResult.error) throw dipendentiResult.error;

      const loadedDipendenti = (dipendentiResult.data ?? []) as Dipendente[];
      const loadedFestivita = (festivitaResult.data ?? []) as Festivita[];

      setCodici((codiciResult.data ?? []) as CodicePresenza[]);
      setFestivita(loadedFestivita);
      setDipendenti(loadedDipendenti);

      const employeeIds = loadedDipendenti.map((item) => item.utente_id);

      if (employeeIds.length === 0) {
        setValues({});
        return;
      }

      const { data: presenzeData, error: presenzeError } = await supabase
        .from('tbpresenze_dipendenti')
        .select(`
  id,
  studio_id,
  utente_id,
  data_presenza,
  codice_presenza,
  note,
  inserito_da,
  richiesta_ferie_permessi_id,
  generata_da_richiesta_ferie_permessi
`)
        .eq('studio_id', typedUser.studio_id)
        .gte('data_presenza', startDate)
        .lte('data_presenza', endDate)
        .in('utente_id', employeeIds);

      if (presenzeError) throw presenzeError;

      const loadedValues: Record<string, string> = {};

     const loadedLockedCells: Record<string, boolean> = {};

(presenzeData ?? []).forEach((presence: Presenza) => {
  const key = `${presence.utente_id}|${presence.data_presenza}`;

  loadedValues[key] = presence.codice_presenza;

  loadedLockedCells[key] = Boolean(
    presence.generata_da_richiesta_ferie_permessi ||
      presence.richiesta_ferie_permessi_id,
  );
});

setLockedCells(loadedLockedCells);
      const loadedHolidaysByDate = new Map<string, Festivita>();
      loadedFestivita.forEach((item) => loadedHolidaysByDate.set(item.data_festivita, item));

      const totalDays = getDaysInMonth(year, monthIndex);
      const monthDaysForDefaults: DayInfo[] = Array.from({ length: totalDays }, (_, index) => {
        const day = index + 1;
        const date = toDateKey(year, monthIndex, day);
        const weekday = new Date(year, monthIndex, day).getDay();
        const holiday = loadedHolidaysByDate.get(date);

        return {
          date,
          day,
          weekday,
          isWeekend: weekday === 0 || weekday === 6,
          isHoliday: Boolean(holiday),
          holidayDescription: holiday?.descrizione ?? undefined,
        };
      });

      const todayKey = getTodayKey();

      loadedDipendenti.forEach((dipendente) => {
        monthDaysForDefaults.forEach((day) => {
          const key = `${dipendente.utente_id}|${day.date}`;

          if (!loadedValues[key] && day.date <= todayKey && (day.isWeekend || day.isHoliday)) {
            loadedValues[key] = DEFAULT_NON_WORKDAY_CODE;
          }
        });
      });

      setValues(loadedValues);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Errore durante il caricamento delle presenze.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [endDate, monthIndex, startDate, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canEditEmployee = (utenteId: string) => {
    return currentUser?.id === utenteId;
  };

  const handleChange = (utenteId: string, date: string, code: string) => {
    if (!canEditEmployee(utenteId)) return;

    setSuccess(null);
    setValues((prev) => ({ ...prev, [`${utenteId}|${date}`]: code }));
  };

  const getCode = (utenteId: string, day: DayInfo) => {
    return values[`${utenteId}|${day.date}`] ?? '';
  };

  const getSummaryForEmployee = (utenteId: string) => {
    return summarize(days.map((day) => getCode(utenteId, day)));
  };

const validateRequiredWorkdays = () => {
  const today = new Date();
  const todayKey = getTodayKey();

  const editableDipendenti = dipendenti.filter((dipendente) =>
    canEditEmployee(dipendente.utente_id),
  );

  const getFridayOfWeek = (date: Date) => {
    const d = new Date(date);
    const weekday = d.getDay(); // Dom 0, Lun 1, ..., Ven 5
    const diffToFriday = 5 - weekday;
    d.setDate(d.getDate() + diffToFriday);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const currentWeekFriday = getFridayOfWeek(today);

  for (const dipendente of editableDipendenti) {
    const missingDays = days.filter((day) => {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);

      if (day.date > todayKey) return false;
      if (day.isWeekend || day.isHoliday) return false;

      const fridayOfDayWeek = getFridayOfWeek(dayDate);

      // La settimana diventa obbligatoria solo dal venerdì della stessa settimana
      if (currentWeekFriday < fridayOfDayWeek) return false;

      // Se oggi non è ancora venerdì, non controllo la settimana corrente
      if (today.getDay() < 5 && fridayOfDayWeek.getTime() === currentWeekFriday.getTime()) {
        return false;
      }

      const code = getCode(dipendente.utente_id, day);
      return !code;
    });

    if (missingDays.length > 0) {
      throw new Error(
        `Compila le presenze settimanali obbligatorie per ${getEmployeeName(
          dipendente,
        )}. Giorni mancanti: ${missingDays.map((day) => day.day).join(', ')}.`,
      );
    }
  }
};

  const saveMonth = async () => {
    if (!currentUser) return;

    const supabase = getBrowserSupabaseClient();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      validateRequiredWorkdays();

      const overLimitEmployee = dipendenti.find((dipendente) => {
        const summary = getSummaryForEmployee(dipendente.utente_id);
        return summary.permessi104Ore > 24;
      });

      if (overLimitEmployee) {
        const summary = getSummaryForEmployee(overLimitEmployee.utente_id);
        throw new Error(
          `Limite permessi L.104 superato per ${getEmployeeName(
            overLimitEmployee,
         )}: ${formatHoursMinutes(summary.permessi104Ore)} su massimo 24:00h mensili.`,
        );
      }

      const editableDipendenti = dipendenti.filter((dipendente) =>
        canEditEmployee(dipendente.utente_id),
      );

     const rowsToUpsert: any[] = [];
const rowsToDelete: { utente_id: string; data_presenza: string }[] = [];

editableDipendenti.forEach((dipendente) => {
  days.forEach((day) => {
    const codicePresenza = getCode(dipendente.utente_id, day);

    if (!codicePresenza || codicePresenza === '-') {
      rowsToDelete.push({
        utente_id: dipendente.utente_id,
        data_presenza: day.date,
      });
      return;
    }

    rowsToUpsert.push({
      studio_id: currentUser.studio_id,
      utente_id: dipendente.utente_id,
      data_presenza: day.date,
      codice_presenza: codicePresenza,
      inserito_da: currentUser.id,
      updated_at: new Date().toISOString(),
    });
  });
});

if (rowsToDelete.length > 0) {
  for (const row of rowsToDelete) {
    const { error: deleteError } = await supabase
      .from('tbpresenze_dipendenti')
      .delete()
      .eq('studio_id', currentUser.studio_id)
      .eq('utente_id', row.utente_id)
      .eq('data_presenza', row.data_presenza)
      .eq('generata_da_richiesta_ferie_permessi', false);

    if (deleteError) throw deleteError;
  }
}

if (rowsToUpsert.length > 0) {
  const { error: upsertError } = await supabase
    .from('tbpresenze_dipendenti')
    .upsert(rowsToUpsert, { onConflict: 'utente_id,data_presenza' });

  if (upsertError) throw upsertError;
}

if (rowsToUpsert.length === 0 && rowsToDelete.length === 0) {
  setSuccess('Nessuna presenza da salvare.');
  return;
}

      setSuccess('Presenze del mese salvate correttamente.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Errore durante il salvataggio delle presenze.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const exportZucchettiXml = () => {
    if (!isResponsabilePaghe) {
      setError('Export XML Paghe disponibile solo per i responsabili paghe.');
      return;
    }

    const dipendentiConCodici = dipendenti.filter((dipendente) => {
      const codiceDitta = dipendente.codice_ditta?.trim();
      const codiceDipendente =
        dipendente.codice_soggetto_paghe?.trim() || dipendente.codice_dipendente?.trim();

      return Boolean(codiceDitta && codiceDipendente);
    });

    if (dipendentiConCodici.length === 0) {
      setError(
        'Nessun dipendente esportabile. Verifica codice ditta e codice dipendente/soggetto paghe.',
      );
      return;
    }

    const dipendentiPerAzienda = dipendentiConCodici.reduce<Record<string, Dipendente[]>>(
      (acc, dipendente) => {
        const codiceDitta = dipendente.codice_ditta?.trim() || '';
        if (!acc[codiceDitta]) acc[codiceDitta] = [];
        acc[codiceDitta].push(dipendente);
        return acc;
      },
      {},
    );

    Object.entries(dipendentiPerAzienda).forEach(([codiceDitta, dipendentiAzienda]) => {
      const dipendentiXml = dipendentiAzienda
        .map((dipendente) => {
          const codiceDipendente =
            dipendente.codice_soggetto_paghe?.trim() ||
            dipendente.codice_dipendente?.trim() ||
            '';

          const dailyHours = Number(dipendente.orario_giornaliero ?? 8);

          const movimenti = days
            .flatMap((day) => {
              let code = getCode(dipendente.utente_id, day);

              if (!code && (day.isWeekend || day.isHoliday)) {
                code = DEFAULT_NON_WORKDAY_CODE;
              }

              if (!code) return [];

              const movements: string[] = [];
             const isPermesso = isPermessoCode(code);
const isPermesso104 = isPermesso104Code(code);
const isAllattamento = code === 'AL1' || code === 'AL2';

if (isPermesso || isPermesso104 || isAllattamento) {
                const orePermesso = getPresenceHours(code, dailyHours);
                const oreLavorate = Math.max(0, dailyHours - orePermesso);

                if (oreLavorate > 0) {
                  movements.push(createXmlMovimento(day.date, '01', oreLavorate));
                }

                movements.push(
                 createXmlMovimento(
  day.date,
  isAllattamento ? 'AL' : isPermesso104 ? 'PG' : 'RL',
  orePermesso,
),
                );

                return movements;
              }

              const giustificativo = getXmlGiustificativo(code);
              if (!giustificativo) return [];

              const hours = getPresenceHours(code, dailyHours);
              movements.push(createXmlMovimento(day.date, giustificativo, hours));

              return movements;
            })
            .join('\n');

          return `  <Dipendente CodAziendaUfficiale="${escapeXml(
            codiceDitta,
          )}" CodDipendenteUfficiale="${escapeXml(codiceDipendente)}">
    <Movimenti GenerazioneAutomaticaDaTeorico="N">
${movimenti}
    </Movimenti>
  </Dipendente>`;
        })
        .join('\n');

      const xml = `<Fornitura>
${dipendentiXml}
</Fornitura>
`;

      downloadXml(`presenze_paghe_${codiceDitta}_${year}_${pad2(monthIndex + 1)}.xml`, xml);
    });
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

           {currentUser?.tipo_rapporto === "Dipendente" && (
  <Button
    variant="outline"
    onClick={() => {
      window.location.href = '/presenze/richiesta-ferie-permessi';
    }}
  >
    Richiesta ferie/permessi
  </Button>
)}
            
   <Button variant="outline" onClick={loadData} disabled={loading || saving}>
  Aggiorna
</Button>

{isResponsabilePaghe && (
  <Button
    variant="outline"
    onClick={() => {
      window.location.href = "/presenze/ferie-permessi";
    }}
  >
    Gestione Ferie/permessi
  </Button>
)}

{isResponsabilePaghe && (
  <Button
    variant="outline"
   onClick={async () => {
  try {
    setError(null);
    setSuccess(null);
    setLoadingSolleciti(true);

        const res = await fetch("/api/presenze/sollecita-compilazione", {
          method: "POST",
        });

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Errore recupero dipendenti da sollecitare");
        }

        setSolleciti(
          (data.dipendenti || []).map((d: any) => ({
            ...d,
            selezionato: true,
            livello: d.livello || (d.mancanti >= 3 ? "urgente" : "normale"),
          }))
        );

        setModalSollecitiOpen(true);
    } catch (err: any) {
    setError(err?.message || "Errore recupero solleciti");
  } finally {
    setLoadingSolleciti(false);
  }
}}
  >
    Sollecita compilazione
  </Button>
)}
            
            <Button
              variant="outline"
              onClick={exportZucchettiXml}
              disabled={loading || dipendenti.length === 0 || !isResponsabilePaghe}
            >
              Export XML Paghe
            </Button>

            <Button
              onClick={saveMonth}
              disabled={
                loading ||
                saving ||
                isLockedPeriod ||
                !dipendenti.some((dipendente) => canEditEmployee(dipendente.utente_id))
              }
            >
              {saving ? 'Salvataggio...' : 'Salva mese'}
            </Button>
          </div>
        </div>

        {isLockedPeriod && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            La gestione presenze è attiva solo a partire da Aprile 2026.
          </div>
        )}

        <Card>
         <CardHeader className="pb-1">
            <CardTitle className="text-base">Periodo</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Mese
                </label>
                <select
  value={String(monthIndex)}
  onChange={(e) => setMonthIndex(Number(e.target.value))}
  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
>
  {MONTHS.map((month, index) => (
    <option key={month} value={String(index)}>
      {month}
    </option>
  ))}
</select>
              </div>

              <div className="w-[120px]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Anno
                </label>
               <select
  value={String(year)}
  onChange={(e) => setYear(Number(e.target.value))}
  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
>
  {Array.from({ length: 7 }, (_, index) => now.getFullYear() - 3 + index).map((item) => (
    <option key={item} value={String(item)}>
      {item}
    </option>
  ))}
</select>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge className="border bg-green-100 text-green-800 hover:bg-green-100">
                  Pp ufficio
                </Badge>
                <Badge className="border bg-violet-100 text-violet-800 hover:bg-violet-100">
                  Ps smart
                </Badge>
                <Badge className="border bg-sky-100 text-sky-800 hover:bg-sky-100">
                  F ferie
                </Badge>
                <Badge className="border bg-red-100 text-red-800 hover:bg-red-100">
                  M malattia
                </Badge>
                <Badge className="border bg-gray-100 text-gray-700 hover:bg-gray-100">
                  N non lavorativo
                </Badge>
                <Badge className="border bg-orange-100 text-orange-800 hover:bg-orange-100">
                  P0.25-P8 permessi
                </Badge>
                <Badge className="border bg-pink-100 text-pink-800 hover:bg-pink-100">
                  P0.25.104-P8.104 L.104
                </Badge>
<div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
  <p>
    Per i permessi orari è sufficiente inserire il codice del permesso
    (es. <strong>P2</strong>, <strong>P4</strong>, <strong>P1.104</strong>).
    Il sistema calcola automaticamente sia le ore di permesso sia le ore lavorate residue
    ai fini dell’elaborazione payroll ed export paghe.
  </p>

  <p className="mt-2 text-[15px] font-bold text-blue-950">
    Sabati, domeniche e festivi vengono compilati automaticamente come non lavorativi.
  </p>
</div>
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
              <div className="py-8 text-center text-sm text-muted-foreground">
                Caricamento presenze...
              </div>
            ) : accessDenied ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
                Accesso non consentito: il modulo presenze è disponibile solo per utenti con rapporto Dipendente.
              </div>
            ) : dipendenti.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nessun dipendente trovato.
              </div>
            ) : (

<div className="max-h-[320px] w-full overflow-auto rounded-md border">
  <div
    className="min-w-max text-xs"
    style={{
      display: 'grid',
      gridTemplateColumns: `220px repeat(${days.length + 7}, 88px)`,
    }}
  >
    <div className="sticky left-0 top-0 z-50 border-b bg-background px-2 py-2 font-medium text-muted-foreground">
      Dipendente
    </div>

    {days.map((day) => (
      <div
        key={day.date}
        title={day.holidayDescription}
        className={`sticky top-0 z-40 border-b px-2 py-2 text-center font-medium ${
          day.isHoliday
            ? 'bg-lime-200 text-lime-950'
            : day.isWeekend
              ? 'bg-gray-50 text-gray-500'
              : 'bg-background'
        }`}
      >
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[11px] uppercase">{WEEKDAYS_SHORT[day.weekday]}</span>
          <span className="text-sm font-semibold">{day.day}</span>
          {day.isHoliday && <span className="text-[10px]">fest.</span>}
        </div>
      </div>
    ))}

{[
  { top: 'Tot.', bottom: 'Pp' },
  { top: 'Tot.', bottom: 'Ps' },
  { top: 'Tot.', bottom: 'F' },
  { top: 'Tot.', bottom: 'M' },
  { top: 'Tot.', bottom: 'N' },
  { top: 'Tot.', bottom: 'Perm.' },
  { top: 'Tot.', bottom: 'L.104' },
].map((item) => (
  <div
    key={item.bottom}
    className="sticky top-0 z-40 border-b bg-background h-[64px] flex flex-col items-center justify-center text-center"
  >
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
      {item.top}
    </div>

    <div className="mt-1 text-xs font-semibold leading-none">
      {item.bottom}
    </div>
  </div>
))}
    
    {dipendenti.map((dipendente) => {
      const summary = getSummaryForEmployee(dipendente.utente_id);

      return (
        <div key={dipendente.utente_id} className="contents">
          <div className="sticky left-0 z-30 border-b bg-background px-2 py-2 font-medium shadow-sm">
            <div className="flex flex-col">
              <span>{getEmployeeName(dipendente)}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {dipendente.email}
              </span>
            </div>
          </div>

          {days.map((day) => {
            const code = getCode(dipendente.utente_id, day);

const todayKey = getTodayKey();

const isFutureDay = day.date > todayKey;

          const isLockedByRequest =
          lockedCells[`${dipendente.utente_id}|${day.date}`];

            return (
              <div
                key={`${dipendente.utente_id}-${day.date}`}
                className="border-b p-1 text-center"
              >
                <select
               disabled={
  isLockedPeriod ||
  !canEditEmployee(dipendente.utente_id) ||
  isLockedByRequest ||
  isFutureDay
}
                  value={code}
                  onChange={(event) =>
                    handleChange(dipendente.utente_id, day.date, event.target.value)
                  }
                  title={
  isFutureDay
    ? 'Non è possibile compilare giorni successivi alla data odierna.'
    : isLockedByRequest
      ? 'Presenza generata da richiesta ferie/permessi approvata. Usa Revoca.'
      : day.holidayDescription
}
  className={`h-8 w-[82px] rounded-md border px-2 text-xs outline-none ${
  isLockedByRequest || isFutureDay
    ? 'cursor-not-allowed opacity-60'
    : ''
} ${                    code
                      ? day.isHoliday
                        ? getHolidayCellClass(code)
                        : getCellClass(code)
                      : day.date <= getTodayKey()
                        ? 'bg-yellow-50 text-gray-700 border-yellow-300'
                        : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
                  <option value="">-</option>
                  {allowedCodes.map((item) => (
                    <option key={item.codice} value={item.codice}>
                      {item.codice}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-green-100 font-bold text-green-900">
    {summary.pp}
  </div>
</div>

<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-violet-100 font-bold text-violet-900">
    {summary.ps}
  </div>
</div>

<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-sky-100 font-bold text-sky-900">
    {summary.ferie}
  </div>
</div>

<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-red-100 font-bold text-red-900">
    {summary.malattia}
  </div>
</div>

<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-gray-100 font-bold text-gray-800">
    {summary.festivi}
  </div>
</div>

<div className="border-b p-1 text-center">
  <div className="flex h-8 items-center justify-center rounded-md bg-orange-100 font-bold text-orange-900">
    {formatHoursMinutes(summary.permessiOre)}
  </div>
</div>

<div className="border-b p-1 text-center">
  <div
    className={`flex h-8 items-center justify-center rounded-md bg-pink-100 font-bold ${
      summary.permessi104Ore > 24 ? "text-red-700" : "text-pink-900"
    }`}
  >
    {formatHoursMinutes(summary.permessi104Ore)}
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>
      
            )}
          </CardContent>
        </Card>
      </div>

      {loadingSolleciti && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div className="w-[360px] rounded-lg bg-white p-6 shadow-lg">
      <div className="mb-3 text-base font-semibold">
        Elaborazione in corso...
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
      </div>

      <div className="mt-3 text-sm text-gray-500">
        Verifica presenze dipendenti in corso.
      </div>
    </div>
  </div>
)}
      
      {modalSollecitiOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-xl font-semibold">
        Dipendenti con presenze incomplete
      </h2>

      <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
  Totale completamenti minimi richiesti:
  <strong className="ml-1">
    {solleciti.reduce(
      (tot, s) => tot + Number(s.mancanti || 0),
      0
    )}
  </strong>
</div>

      {solleciti.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessun dipendente da sollecitare.
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-center">Invia</th>
                <th className="p-2 text-left">Dipendente</th>
                <th className="p-2 text-left">Email</th>
               <th className="p-2 text-center">Compilate</th>
              <th className="p-2 text-center">Da completare per soglia</th>
                <th className="p-2 text-center">Priorità</th>
              </tr>
            </thead>

            <tbody>
              {solleciti.map((s, index) => (
                <tr key={s.utente_id || s.id || index} className="border-t">
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!s.selezionato}
                      onChange={(e) =>
                        setSolleciti((prev) =>
                          prev.map((x, i) =>
                            i === index
                              ? { ...x, selezionato: e.target.checked }
                              : x
                          )
                        )
                      }
                    />
                  </td>

                  <td className="p-2">
                    {s.cognome || ""} {s.nome || ""}
                  </td>

                  <td className="p-2">{s.email}</td>

                  <td className="p-2 text-center">
                    {s.presenze_compilate}
                  </td>

                  <td className="p-2 text-center font-semibold text-red-600">
                    {s.mancanti}
                  </td>

                  <td className="p-2 text-center">
                    <select
                      className="rounded border px-2 py-1"
                      value={s.livello}
                      onChange={(e) =>
                        setSolleciti((prev) =>
                          prev.map((x, i) =>
                            i === index
                              ? { ...x, livello: e.target.value }
                              : x
                          )
                        )
                      }
                    >
                      <option value="normale">Normale</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setModalSollecitiOpen(false)}
          disabled={sendingSolleciti}
        >
          Annulla
        </Button>

        <Button
          disabled={sendingSolleciti || solleciti.filter((s) => s.selezionato).length === 0}
          onClick={async () => {
            try {
              setSendingSolleciti(true);
              setError(null);
              setSuccess(null);

              let inviati = 0;

              for (const dipendente of solleciti.filter((s) => s.selezionato)) {
                const urgente = dipendente.livello === "urgente";

                const result = await sendEmail({
                  to: dipendente.email,
                  subject: urgente
                    ? "URGENTE - Sollecito compilazione foglio presenze"
                    : "Sollecito compilazione foglio presenze",
                  html: `
                    <p>Gentile ${dipendente.cognome || ""} ${dipendente.nome || ""},</p>
                    <p>risultano compilate <strong>${dipendente.presenze_compilate}</strong> presenze nel mese corrente.</p>
                    <p>Il minimo richiesto è di <strong>4</strong> presenze.</p>
                    <p>Mancano ancora <strong>${dipendente.mancanti}</strong> giornate.</p>
                    ${urgente ? "<p><strong>La richiesta è urgente.</strong></p>" : ""}
                    <p>Ti chiediamo cortesemente di completare la compilazione in Studio Manager Pro.</p>
                    <p>Grazie per la collaborazione.</p>
                  `,
                  text: `
Gentile ${dipendente.cognome || ""} ${dipendente.nome || ""},

risultano compilate ${dipendente.presenze_compilate} presenze nel mese corrente.
Il minimo richiesto è di 4 presenze.
Mancano ancora ${dipendente.mancanti} giornate.

${urgente ? "La richiesta è urgente.\n" : ""}
Ti chiediamo cortesemente di completare la compilazione in Studio Manager Pro.

Grazie per la collaborazione.
                  `.trim(),
                  sendMode: "studio",
                });

                if (!result.success) {
                  throw new Error(result.error || `Errore invio email a ${dipendente.email}`);
                }

                inviati++;
              }

              setSuccess(`Solleciti inviati: ${inviati}`);
              setModalSollecitiOpen(false);
            } catch (err: any) {
              setError(err?.message || "Errore invio solleciti");
            } finally {
              setSendingSolleciti(false);
            }
          }}
        >
          {sendingSolleciti ? "Invio..." : "Invia email selezionati"}
        </Button>
      </div>
    </div>
  </div>
)}
    </>
  );
}

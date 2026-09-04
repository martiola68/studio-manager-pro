begin;

-- 1) Il vecchio flag acconto_imu diventa il flag unico Soggetto IMU.
alter table public.tbscadimu
  rename column acconto_imu to soggetto_imu;

-- 2) Normalizza il flag soggetto e i due dovuti.
update public.tbscadimu
set soggetto_imu = false
where soggetto_imu is null;

update public.tbscadimu
set acconto_dovuto = true,
    saldo_dovuto = true
where soggetto_imu is true;

update public.tbscadimu
set acconto_dovuto = false,
    saldo_dovuto = false
where soggetto_imu is false;

alter table public.tbscadimu
  alter column soggetto_imu set default false,
  alter column soggetto_imu set not null;

-- 3) Il flag saldo_imu non ha più significato: il soggetto è unico per Acconto e Saldo.
alter table public.tbscadimu
  drop column saldo_imu;

comment on column public.tbscadimu.soggetto_imu is
  'Flag unico soggetto IMU. Se true, acconto_dovuto e saldo_dovuto sono inizialmente true.';

commit;

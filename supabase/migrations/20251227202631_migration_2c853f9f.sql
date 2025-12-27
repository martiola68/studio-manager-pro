-- Disabilita RLS anche su tbconversazioni_utenti per test
ALTER TABLE tbconversazioni_utenti DISABLE ROW LEVEL SECURITY;

-- Verifica
SELECT 
  '1. RLS DISABILITATO ANCHE SU PARTECIPANTI' as test,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('tbconversazioni', 'tbconversazioni_utenti')
ORDER BY tablename;
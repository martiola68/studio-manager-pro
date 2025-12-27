-- 4. Disabilita TEMPORANEAMENTE RLS per test (poi lo riabiliteremo)
ALTER TABLE tbconversazioni DISABLE ROW LEVEL SECURITY;

-- Verifica che RLS sia disabilitato
SELECT 
  '4. RLS DISABILITATO (TEST)' as test,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'tbconversazioni';
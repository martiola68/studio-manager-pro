-- STEP 1: Rimuovere policy SELECT vecchia troppo restrittiva
DROP POLICY IF EXISTS "Users can view their own promemoria" ON tbpromemoria;

-- STEP 2: Creare nuova policy avanzata con filtro automatico basato su ruolo
CREATE POLICY "Users can view promemoria based on role" ON tbpromemoria
FOR SELECT USING (
  -- Caso 1: Vedi promemoria creati da te (operatore)
  auth.uid() = operatore_id
  OR 
  -- Caso 2: Vedi promemoria assegnati a te (destinatario)
  auth.uid() = destinatario_id
  OR
  -- Caso 3: Se sei RESPONSABILE, vedi tutti i promemoria del tuo settore
  (
    EXISTS (
      SELECT 1 FROM tbutenti
      WHERE tbutenti.id = auth.uid()
      AND tbutenti.responsabile = true
      AND tbutenti.settore = tbpromemoria.settore
    )
  )
);

COMMENT ON POLICY "Users can view promemoria based on role" ON tbpromemoria IS 
'Filtro automatico: Responsabili vedono tutto il loro settore, utenti generici solo i propri promemoria';
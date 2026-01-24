-- Rimuovo la vecchia policy di UPDATE
DROP POLICY IF EXISTS "Users can update promemoria as operator or recipient" ON tbpromemoria;

-- Creo la nuova policy che include i Responsabili del settore
CREATE POLICY "Users can update promemoria as operator, recipient or sector responsible"
ON tbpromemoria
FOR UPDATE
USING (
  (auth.uid() = operatore_id) OR 
  (auth.uid() = destinatario_id) OR
  (EXISTS (
    SELECT 1 FROM tbutenti 
    WHERE tbutenti.id = auth.uid() 
    AND tbutenti.responsabile = true 
    AND tbutenti.settore = tbpromemoria.settore
  ))
);
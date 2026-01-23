-- Elimino la vecchia policy UPDATE restrittiva
DROP POLICY IF EXISTS "Users can update their own promemoria" ON tbpromemoria;

-- Creo nuova policy che permette UPDATE sia all'operatore che al destinatario
CREATE POLICY "Users can update promemoria as operator or recipient"
ON tbpromemoria
FOR UPDATE
USING (
  auth.uid() = operatore_id 
  OR 
  auth.uid() = destinatario_id
);
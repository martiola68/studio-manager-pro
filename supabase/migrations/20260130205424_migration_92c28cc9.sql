-- Rimuovo il vecchio constraint
ALTER TABLE tbutenti DROP CONSTRAINT tbutenti_settore_check;

-- Aggiungo il nuovo constraint con "Consulenza" al posto di "Fiscale & lavoro"
ALTER TABLE tbutenti ADD CONSTRAINT tbutenti_settore_check 
  CHECK (settore IN ('Fiscale', 'Lavoro', 'Consulenza'));
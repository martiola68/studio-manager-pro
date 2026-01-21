-- Aggiungi campo professionista_payroll_id a tbscad770
ALTER TABLE tbscad770 
ADD COLUMN IF NOT EXISTS professionista_payroll_id UUID REFERENCES tbutenti(id);
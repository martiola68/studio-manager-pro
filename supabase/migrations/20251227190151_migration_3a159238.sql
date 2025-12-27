-- SOLUZIONE: Rimuovo TUTTE le policy e ricreo solo quelle corrette e semplici

-- 1. Drop ALL policies from tbconversazioni
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON tbconversazioni;
DROP POLICY IF EXISTS "Users can create conversations in their studio" ON tbconversazioni;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON tbconversazioni;
DROP POLICY IF EXISTS "Users can view their conversations" ON tbconversazioni;
DROP POLICY IF EXISTS "Users can update their conversations" ON tbconversazioni;
DROP POLICY IF EXISTS "Creator can delete conversations" ON tbconversazioni;

-- 2. Drop ALL policies from tbconversazioni_utenti
DROP POLICY IF EXISTS "Authenticated users can add participants" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "Users can add participants to conversations" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "Users can view conversation participants" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "Users can view participants" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "Users can update their participation" ON tbconversazioni_utenti;

-- 3. Create SIMPLE and CORRECT policies for tbconversazioni

-- Anyone authenticated can CREATE conversations
CREATE POLICY "allow_insert_conversations" ON tbconversazioni
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can VIEW conversations they're part of
CREATE POLICY "allow_select_conversations" ON tbconversazioni
FOR SELECT
TO authenticated
USING (is_chat_participant(id));

-- Users can UPDATE conversations they're part of
CREATE POLICY "allow_update_conversations" ON tbconversazioni
FOR UPDATE
TO authenticated
USING (is_chat_participant(id));

-- Creator can DELETE
CREATE POLICY "allow_delete_conversations" ON tbconversazioni
FOR DELETE
TO authenticated
USING (creato_da = auth.uid());

-- 4. Create SIMPLE policies for tbconversazioni_utenti

-- Anyone authenticated can ADD participants
CREATE POLICY "allow_insert_participants" ON tbconversazioni_utenti
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can VIEW participants of their conversations
CREATE POLICY "allow_select_participants" ON tbconversazioni_utenti
FOR SELECT
TO authenticated
USING (is_chat_participant(conversazione_id));

-- Users can UPDATE their own participation record
CREATE POLICY "allow_update_participants" ON tbconversazioni_utenti
FOR UPDATE
TO authenticated
USING (utente_id = auth.uid());
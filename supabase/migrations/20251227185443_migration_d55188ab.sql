-- 1. Drop all existing policies for tbconversazioni
DROP POLICY IF EXISTS "Users can create conversations" ON tbconversazioni;
DROP POLICY IF EXISTS "Users can view their conversations" ON tbconversazioni;
DROP POLICY IF EXISTS "Users can update their conversations" ON tbconversazioni;
DROP POLICY IF EXISTS "Users can delete their conversations" ON tbconversazioni;

-- 2. Create comprehensive policies for tbconversazioni

-- Allow INSERT: any authenticated user can create a conversation
CREATE POLICY "Authenticated users can create conversations" ON tbconversazioni
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow SELECT: users can see conversations they participate in
CREATE POLICY "Users can view their conversations" ON tbconversazioni
FOR SELECT
TO authenticated
USING (is_chat_participant(id));

-- Allow UPDATE: users can update conversations they participate in
CREATE POLICY "Users can update their conversations" ON tbconversazioni
FOR UPDATE
TO authenticated
USING (is_chat_participant(id))
WITH CHECK (is_chat_participant(id));

-- Allow DELETE: only creator can delete conversations
CREATE POLICY "Creator can delete conversations" ON tbconversazioni
FOR DELETE
TO authenticated
USING (creato_da = auth.uid());

-- 3. Update tbconversazioni_utenti policies
DROP POLICY IF EXISTS "Users can add participants" ON tbconversazioni_utenti;
DROP POLICY IF EXISTS "Users can view participants" ON tbconversazioni_utenti;

-- Allow INSERT: any authenticated user can add participants (will be restricted by conversation policies)
CREATE POLICY "Authenticated users can add participants" ON tbconversazioni_utenti
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow SELECT: users can see participants of conversations they're in
CREATE POLICY "Users can view participants" ON tbconversazioni_utenti
FOR SELECT
TO authenticated
USING (is_chat_participant(conversazione_id));
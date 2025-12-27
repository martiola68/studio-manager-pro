-- 1. Drop existing INSERT policy if exists
DROP POLICY IF EXISTS "Users can create conversations" ON tbconversazioni;

-- 2. Create new INSERT policy that allows authenticated users to create conversations
CREATE POLICY "Users can create conversations" ON tbconversazioni
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = creato_da);

-- 3. Ensure the policy for tbconversazioni_utenti allows inserting participants
DROP POLICY IF EXISTS "Users can add participants" ON tbconversazioni_utenti;

CREATE POLICY "Users can add participants" ON tbconversazioni_utenti
FOR INSERT
TO authenticated
WITH CHECK (
  -- Can add participants if you're the creator of the conversation
  EXISTS (
    SELECT 1 FROM tbconversazioni c
    WHERE c.id = tbconversazioni_utenti.conversazione_id
    AND c.creato_da = auth.uid()
  )
);

-- 4. Update policy to allow users to update conversations they're part of
DROP POLICY IF EXISTS "Users can update their conversations" ON tbconversazioni;

CREATE POLICY "Users can update their conversations" ON tbconversazioni
FOR UPDATE
USING (is_chat_participant(id))
WITH CHECK (is_chat_participant(id));
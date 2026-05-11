ALTER TABLE public.pending_business_activations ALTER COLUMN created_by DROP NOT NULL;

-- Allow public (anon) inserts only via service role through edge functions; add a permissive INSERT policy for authenticated and anon to be handled by service role (no policy change needed since service role bypasses RLS). No change required here.
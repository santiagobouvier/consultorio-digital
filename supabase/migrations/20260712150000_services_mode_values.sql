-- La tabla services tenía check (mode in ('in_person','online')), que rechaza
-- los valores del gestor de tipos de sesión ('presencial','ambas').
-- Se normaliza el legacy y se amplía la regla.

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_mode_check;

UPDATE public.services SET mode = 'presencial' WHERE mode = 'in_person';
UPDATE public.services SET mode = 'online' WHERE mode = 'virtual';

ALTER TABLE public.services
  ADD CONSTRAINT services_mode_check CHECK (mode IN ('online', 'presencial', 'ambas'));

-- Limpieza manual de usuario huérfano (no owner de ningún consultorio)
-- gbouvier@dac.com.uy / d2881c2c-ecc8-4e70-9b99-87639cbf1025

DELETE FROM public.pending_business_activations WHERE owner_email = 'gbouvier@dac.com.uy';
DELETE FROM public.profiles WHERE id = 'd2881c2c-ecc8-4e70-9b99-87639cbf1025';
DELETE FROM auth.users WHERE id = 'd2881c2c-ecc8-4e70-9b99-87639cbf1025';
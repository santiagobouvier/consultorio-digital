-- El portal del paciente muestra los documentos compartidos con la etiqueta
-- y el ícono de su tipo. Los tipos propios viven en business_document_types
-- (hasta ahora solo legible por miembros del consultorio): se agrega SELECT
-- para pacientes del mismo consultorio. Solo etiqueta e ícono — nada
-- sensible. Sin esto, un documento compartido de tipo propio mostraría un
-- código en vez de "Radiografía".

CREATE POLICY document_types_select_patient
ON public.business_document_types FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.business_id = business_document_types.business_id
      AND p.auth_user_id = auth.uid()
  )
);

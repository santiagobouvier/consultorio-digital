import { usePageMeta } from "@/hooks/use-page-meta";
import { LegalPage } from "@/components/LegalPage";

// BORRADOR para revisión profesional. Ajustar datos identificatorios del
// titular antes de publicar definitivamente.
const CONTACT_EMAIL = "contacto@consultoriodigital.app";

const Privacy = () => {
  usePageMeta({
    title: "Política de Privacidad | Consultorio Digital",
    description:
      "Cómo tratamos los datos personales de profesionales y pacientes en Consultorio Digital, según la Ley 18.331 de Protección de Datos de Uruguay.",
    canonicalPath: "/privacidad",
  });

  return (
  <LegalPage title="Política de Privacidad" updated="9 de setiembre de 2026">
    <section>
      <h2>1. Responsable y alcance</h2>
      <p>
        Esta política explica cómo <strong>Consultorio Digital</strong>, operado por{" "}
        <strong>Digital Builders</strong> (Uruguay), trata los datos personales en la plataforma, de
        acuerdo con la Ley N° 18.331 de Protección de Datos Personales de Uruguay y su normativa
        complementaria. Contacto para temas de privacidad: {CONTACT_EMAIL}.
      </p>
      <p>Hay dos situaciones distintas, y las explicamos por separado:</p>
      <ul>
        <li>
          <strong>Datos de los profesionales</strong> (quienes contratan la plataforma): actuamos como{" "}
          <strong>responsables</strong> del tratamiento.
        </li>
        <li>
          <strong>Datos de los pacientes</strong> cargados por cada profesional: el{" "}
          <strong>responsable es el profesional</strong>; nosotros actuamos como{" "}
          <strong>encargados del tratamiento</strong> por su cuenta y bajo sus instrucciones.
        </li>
      </ul>
    </section>

    <section>
      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>De profesionales:</strong> nombre, email, teléfono, datos del consultorio (nombre,
          especialidad, logo, colores), configuración, datos de suscripción y estado de pagos
          (procesados por Mercado Pago; no almacenamos números de tarjeta).
        </li>
        <li>
          <strong>De pacientes (por cuenta del profesional):</strong> nombre, contacto (email,
          teléfono), citas, pagos de sesiones, motivo de consulta y notas que el profesional registre.
          Estos datos pueden incluir <strong>datos sensibles de salud</strong>; los tratamos con
          medidas de seguridad reforzadas y solo para prestar el servicio al profesional.
        </li>
        <li>
          <strong>Datos técnicos:</strong> registros de acceso y datos mínimos de funcionamiento.
          Usamos almacenamiento local del navegador para preferencias de interfaz; no usamos cookies
          de publicidad ni vendemos datos.
        </li>
      </ul>
    </section>

    <section>
      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Prestar el servicio: agenda, reservas, portal del paciente, cobros, recordatorios y estadísticas.</li>
        <li>Enviar comunicaciones operativas (confirmaciones de cita, recordatorios, avisos de pago).</li>
        <li>Facturar la suscripción y dar soporte.</li>
        <li>Seguridad, prevención de fraude y cumplimiento legal.</li>
      </ul>
      <p>No usamos los datos de pacientes con fines propios ni de publicidad. Nunca vendemos datos.</p>
    </section>

    <section>
      <h2>4. Con quién se comparten (encargados y servicios)</h2>
      <p>
        Para funcionar utilizamos proveedores que procesan datos por nuestra cuenta, con contratos y
        medidas de seguridad estándar de la industria:
      </p>
      <ul>
        <li><strong>Supabase</strong> — base de datos y autenticación (alojamiento en la nube, puede estar fuera de Uruguay).</li>
        <li><strong>Mercado Pago</strong> — procesamiento de pagos y suscripciones.</li>
        <li><strong>Resend</strong> — envío de emails transaccionales.</li>
        <li><strong>Meta (WhatsApp Business)</strong> — envío de recordatorios y avisos por WhatsApp, cuando el consultorio lo utilice.</li>
        <li><strong>Google (Google Calendar API)</strong> — sincronización de la agenda, únicamente cuando el profesional conecta su cuenta de Google.</li>
      </ul>
      <p>
        Algunos de estos proveedores almacenan datos fuera de Uruguay; en esos casos la transferencia
        internacional se realiza hacia servicios con niveles adecuados de protección o mediante
        salvaguardas contractuales, conforme a la Ley N° 18.331.
      </p>
    </section>


    <section>
      <h2>5. Integración con Google Calendar y calendarios externos</h2>
      <p>
        Si el profesional decide conectar su cuenta de Google, Consultorio Digital accede a su
        calendario mediante la <strong>API de Google Calendar</strong> (permiso{" "}
        <code>calendar.events</code>) con estos únicos fines:
      </p>
      <ul>
        <li>Crear, actualizar y eliminar en Google Calendar los eventos que representan sus citas y eventos personales del sistema.</li>
        <li>Leer los eventos de su calendario para reflejar cambios en la agenda del sistema, mostrar su disponibilidad real y evitar superposiciones al agendar.</li>
      </ul>
      <p>
        No leemos calendarios de terceros, no usamos esta información con fines publicitarios, no la
        vendemos ni la compartimos con nadie, y ninguna persona la revisa salvo que el profesional lo
        pida para soporte, sea necesario por seguridad o lo exija la ley. El profesional puede
        desconectar su cuenta de Google en cualquier momento desde la agenda (sección "Mi
        calendario"), lo que revoca el acceso y elimina las credenciales guardadas; también puede
        revocarlo desde su cuenta de Google en{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          myaccount.google.com/permissions
        </a>
        .
      </p>
      <p>
        El uso que Consultorio Digital hace de la información recibida de las APIs de Google se
        adhiere a la{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Política de Datos de Usuario de los Servicios de API de Google
        </a>
        , incluidos los requisitos de <strong>Uso Limitado</strong> (Limited Use).
      </p>
      <p>
        Lo mismo aplica al calendario del iPhone/iCal: la conexión es opcional, por un enlace privado
        que el profesional puede revocar cuando quiera.
      </p>
    </section>

    <section>
      <h2>6. Seguridad</h2>
      <ul>
        <li>Cifrado en tránsito (HTTPS) y en reposo.</li>
        <li>Aislamiento por consultorio: cada profesional accede únicamente a los datos de su consultorio, y cada paciente solo a los suyos.</li>
        <li>Controles de acceso a nivel de base de datos y credenciales de pago protegidas.</li>
      </ul>
    </section>

    <section>
      <h2>7. Conservación</h2>
      <p>
        Conservamos los datos mientras la cuenta esté activa. Ante la baja de una cuenta, los datos se
        conservan por un plazo razonable para permitir reactivación o exportación y cumplir
        obligaciones legales, y luego se eliminan. El profesional puede solicitar la exportación o
        eliminación de los datos de su consultorio escribiendo a {CONTACT_EMAIL}.
      </p>
    </section>

    <section>
      <h2>8. Tus derechos</h2>
      <p>
        Podés ejercer los derechos de acceso, rectificación, actualización y supresión de tus datos
        (arts. 13 a 16, Ley N° 18.331) escribiendo a {CONTACT_EMAIL}. Si sos{" "}
        <strong>paciente</strong> de un consultorio que usa la plataforma, podés ejercer estos derechos
        directamente ante tu profesional (responsable de tus datos); también podemos canalizar tu
        solicitud hacia él. Autoridad de control: Unidad Reguladora y de Control de Datos Personales
        (URCDP), Uruguay.
      </p>
    </section>

    <section>
      <h2>9. Menores de edad</h2>
      <p>
        La contratación de la plataforma está dirigida a profesionales mayores de 18 años. Los
        profesionales pueden registrar datos de pacientes menores en el marco de su actividad
        asistencial, bajo su responsabilidad y con el consentimiento de sus representantes legales
        cuando corresponda.
      </p>
    </section>

    <section>
      <h2>10. Cambios a esta política</h2>
      <p>
        Si modificamos esta política de forma sustancial, lo comunicaremos por la plataforma o por
        email. La versión vigente estará siempre disponible en esta página.
      </p>
    </section>
  </LegalPage>
);
};

export default Privacy;

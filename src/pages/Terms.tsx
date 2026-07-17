import { LegalPage } from "@/components/LegalPage";

// BORRADOR para revisión profesional. Ajustar los datos identificatorios del
// titular antes de publicar definitivamente.
const CONTACT_EMAIL = "contacto@consultoriodigital.app";

const Terms = () => (
  <LegalPage title="Términos y Condiciones" updated="17 de julio de 2026">
    <section>
      <h2>1. Quiénes somos y qué es este servicio</h2>
      <p>
        <strong>Consultorio Digital</strong> (en adelante, "la Plataforma") es un servicio de software
        operado por <strong>Digital Builders</strong>, con base en Uruguay (en adelante, "nosotros").
        La Plataforma permite a profesionales de la salud mental y disciplinas afines gestionar su
        consultorio: agenda de citas, reservas online, portal para pacientes, registro de pagos,
        recordatorios y estadísticas.
      </p>
      <p>
        Al crear una cuenta o usar la Plataforma aceptás estos Términos y Condiciones y nuestra{" "}
        <a href="/privacidad" className="underline">Política de Privacidad</a>. Si no estás de acuerdo,
        no uses el servicio. Contacto: {CONTACT_EMAIL}.
      </p>
    </section>

    <section>
      <h2>2. Qué NO es la Plataforma</h2>
      <ul>
        <li>
          <strong>No es un servicio de salud ni de emergencias.</strong> La Plataforma es una herramienta
          de gestión administrativa. La relación asistencial es exclusivamente entre el profesional y su
          paciente.
        </li>
        <li>
          <strong>No es una historia clínica oficial.</strong> Las notas y registros que el profesional
          guarde en la Plataforma no sustituyen las obligaciones de registro clínico que la normativa
          aplicable le imponga.
        </li>
        <li>
          <strong>No somos parte de la relación profesional–paciente</strong> ni de los pagos entre
          ellos: los cobros de sesiones se procesan a través de la cuenta de Mercado Pago del propio
          profesional.
        </li>
      </ul>
    </section>

    <section>
      <h2>3. Cuentas y responsabilidad del profesional</h2>
      <ul>
        <li>Debés ser mayor de 18 años y brindar información veraz al registrarte.</li>
        <li>Sos responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
        <li>
          Sos responsable de contar con las habilitaciones profesionales que correspondan para ejercer
          tu actividad, y de la veracidad de la información que publiques en tu web pública y portal.
        </li>
        <li>
          Respecto de los datos de tus pacientes cargados en la Plataforma, actuás como{" "}
          <strong>responsable del tratamiento</strong>; nosotros actuamos como encargados por tu cuenta
          (ver Política de Privacidad).
        </li>
      </ul>
    </section>

    <section>
      <h2>4. Suscripción, prueba y pagos</h2>
      <ul>
        <li>
          La Plataforma se ofrece por suscripción, con un período de prueba gratuito cuando así se
          indique al momento del alta.
        </li>
        <li>
          Los cobros de suscripción se procesan a través de Mercado Pago mediante débito automático
          recurrente. Los precios vigentes se muestran antes de contratar y pueden actualizarse con
          aviso previo razonable.
        </li>
        <li>
          Podés cancelar tu suscripción en cualquier momento desde la Plataforma; el acceso se mantiene
          hasta el fin del período ya abonado. No se realizan reembolsos por períodos parciales.
        </li>
        <li>
          La falta de pago puede derivar en la suspensión del acceso. Tus datos se conservan por un
          plazo razonable tras la suspensión para permitir la reactivación o la exportación.
        </li>
      </ul>
    </section>

    <section>
      <h2>5. Cobros a pacientes con Mercado Pago</h2>
      <p>
        Si conectás tu cuenta de Mercado Pago, los pagos de tus pacientes se acreditan directamente en
        tu cuenta. Las comisiones, contracargos, devoluciones e impuestos de esos cobros son asunto
        entre vos y Mercado Pago. La Plataforma solo genera los links y registra el estado de los pagos.
      </p>
    </section>

    <section>
      <h2>6. Uso aceptable</h2>
      <ul>
        <li>No uses la Plataforma para actividades ilegales, spam o para cargar datos de terceros sin base legal.</li>
        <li>No intentes vulnerar la seguridad, acceder a datos de otros consultorios ni revender el servicio sin autorización.</li>
        <li>Podemos suspender cuentas que incumplan estos términos, previo aviso cuando sea posible.</li>
      </ul>
    </section>

    <section>
      <h2>7. Disponibilidad y respaldo</h2>
      <p>
        Nos esforzamos por mantener el servicio disponible y tus datos respaldados, pero la Plataforma
        se ofrece "tal cual", sin garantía de disponibilidad ininterrumpida. Ante mantenimientos
        programados que afecten el uso, procuraremos avisar con antelación.
      </p>
    </section>

    <section>
      <h2>8. Límite de responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley, nuestra responsabilidad total frente a vos por
        cualquier reclamo derivado del uso de la Plataforma se limita al monto abonado por tu
        suscripción en los últimos 12 meses. No respondemos por lucro cesante ni daños indirectos, ni
        por las decisiones profesionales o clínicas adoptadas por los usuarios.
      </p>
    </section>

    <section>
      <h2>9. Propiedad intelectual</h2>
      <p>
        La Plataforma, su marca, diseño y código nos pertenecen. Los datos que cargás (tus pacientes,
        notas, configuración, tu logo) son tuyos: nos otorgás únicamente la licencia necesaria para
        prestarte el servicio. Podés solicitar la exportación de tus datos al correo de contacto.
      </p>
    </section>

    <section>
      <h2>10. Cambios y terminación</h2>
      <p>
        Podemos actualizar estos términos; si el cambio es sustancial, lo comunicaremos por la
        Plataforma o por email con antelación razonable. Si continuás usando el servicio luego del
        cambio, se entiende que lo aceptás. Podés dar de baja tu cuenta en cualquier momento
        escribiendo a {CONTACT_EMAIL}.
      </p>
    </section>

    <section>
      <h2>11. Ley aplicable y jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República Oriental del Uruguay. Toda controversia
        se someterá a los tribunales competentes de Montevideo, Uruguay.
      </p>
    </section>
  </LegalPage>
);

export default Terms;

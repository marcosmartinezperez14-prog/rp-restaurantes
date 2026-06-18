import LegalLayout from '@/components/landing/LegalLayout'

export const metadata = { title: 'Aviso Legal — RP Restaurantes' }

export default function AvisoLegalPage() {
  return (
    <LegalLayout titulo="Aviso Legal" actualizado="junio 2025">
      <h2>1. Datos identificativos del titular</h2>
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad
        de la Información y del Comercio Electrónico (LSSI-CE), se informa de los datos del titular del
        sitio web:
      </p>
      <ul>
        <li><strong>Denominación social:</strong> RP Restaurantes</li>
        <li><strong>Actividad:</strong> Prestación de software de gestión para hostelería</li>
        <li><strong>Correo electrónico:</strong> hola@rp-restaurantes.com</li>
      </ul>

      <h2>2. Objeto y ámbito de aplicación</h2>
      <p>
        El presente Aviso Legal regula el acceso y uso del sitio web <strong>rp-restaurantes.com</strong>
        (en adelante, «el Sitio»), así como los servicios disponibles a través del mismo. El acceso al
        Sitio atribuye la condición de usuario e implica la aceptación plena y sin reservas de todas las
        disposiciones incluidas en este Aviso Legal.
      </p>

      <h2>3. Propiedad intelectual e industrial</h2>
      <p>
        Todos los contenidos del Sitio —incluyendo textos, imágenes, logotipos, iconos, código fuente,
        diseño gráfico y cualquier otro elemento— son propiedad de RP Restaurantes o de sus licenciantes,
        y están protegidos por la legislación española e internacional en materia de propiedad intelectual
        e industrial.
      </p>
      <p>
        Queda expresamente prohibida la reproducción, distribución, comunicación pública o transformación
        de cualquier contenido del Sitio sin la autorización previa y por escrito del titular.
      </p>

      <h2>4. Condiciones de uso</h2>
      <p>El usuario se compromete a:</p>
      <ul>
        <li>No utilizar el Sitio con fines ilícitos, fraudulentos o contrarios a la buena fe.</li>
        <li>No introducir o difundir contenidos que vulneren derechos de terceros.</li>
        <li>No realizar acciones que puedan dañar, inutilizar o deteriorar el Sitio o impedir su normal
        funcionamiento.</li>
      </ul>

      <h2>5. Exclusión de garantías y responsabilidad</h2>
      <p>
        RP Restaurantes no garantiza la disponibilidad, continuidad ni infalibilidad del Sitio.
        Tampoco será responsable de los daños o perjuicios causados por interrupciones del servicio,
        errores tipográficos o inexactitudes en la información publicada.
      </p>
      <p>
        El Sitio puede contener enlaces a páginas de terceros. RP Restaurantes no se hace responsable
        del contenido de dichos sitios ni de las prácticas de privacidad de los mismos.
      </p>

      <h2>6. Legislación aplicable y jurisdicción</h2>
      <p>
        Este Aviso Legal se rige por la legislación española. Para la resolución de cualquier
        controversia derivada del acceso o uso del Sitio, las partes se someten, con renuncia expresa
        a cualquier otro fuero, a los Juzgados y Tribunales competentes según la normativa vigente.
      </p>
    </LegalLayout>
  )
}

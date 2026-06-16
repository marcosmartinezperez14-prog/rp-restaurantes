import type { LegalTipo } from '@/types/legal'

// Plantillas por defecto (RGPD España). Se muestran cuando el restaurante aún
// no ha personalizado su texto legal, para no dejar nunca una página en blanco.
// {NOMBRE} se sustituye por el nombre del restaurante.
export function plantillaLegal(tipo: LegalTipo, nombreRestaurante: string): string {
  const nombre = nombreRestaurante || 'el restaurante'

  switch (tipo) {
    case 'privacidad':
      return `# Política de privacidad

**Responsable del tratamiento:** ${nombre}.

**Finalidad:** gestionar las reservas y la comunicación con los clientes que
contactan a través de esta página. Los datos facilitados (nombre, teléfono y, en
su caso, las notas de la reserva) se utilizan únicamente para gestionar y
confirmar tu reserva.

**Base legítima:** la ejecución de la reserva solicitada y tu consentimiento,
prestado de forma expresa al marcar la casilla de aceptación.

**Conservación:** los datos se conservan durante el tiempo necesario para
gestionar la reserva y, posteriormente, durante los plazos legalmente exigibles.

**Destinatarios:** no se ceden datos a terceros salvo obligación legal.

**Derechos (ARCO-POL):** puedes ejercer tus derechos de acceso, rectificación,
supresión, oposición, limitación del tratamiento y portabilidad de tus datos,
así como retirar el consentimiento prestado, contactando con ${nombre}.

**Reclamaciones:** tienes derecho a reclamar ante la Agencia Española de
Protección de Datos (www.aepd.es) si consideras que el tratamiento no se ajusta
a la normativa.

**Datos de contacto:** para cualquier cuestión sobre tus datos, ponte en
contacto con ${nombre} a través de los medios habituales del establecimiento.`

    case 'aviso_legal':
      return `# Aviso legal

**Titular:** ${nombre}.

**Objeto:** este sitio permite consultar la carta y solicitar reservas en
${nombre}.

**Condiciones de uso:** el usuario se compromete a hacer un uso adecuado de los
contenidos y servicios, y a facilitar información veraz en las reservas.

**Propiedad intelectual:** los contenidos de este sitio (textos, imágenes y
marcas) pertenecen a sus respectivos titulares y no pueden reproducirse sin
autorización.

**Responsabilidad:** ${nombre} no se hace responsable del mal uso de los
contenidos ni de los daños derivados de un uso incorrecto del sitio.

**Legislación aplicable:** este aviso legal se rige por la legislación española.`

    case 'cookies':
      return `# Política de cookies

**¿Qué son las cookies?** Son pequeños archivos que se almacenan en tu
dispositivo cuando visitas una página web.

**Cookies que utilizamos:** este sitio utiliza únicamente cookies técnicas
necesarias para su funcionamiento y para recordar tu preferencia sobre el uso de
cookies. Estas cookies no requieren tu consentimiento.

**Cookies de terceros:** actualmente no se utilizan cookies de analítica ni de
terceros. Si en el futuro se incorporasen, no se activarían sin tu aceptación
previa.

**Gestión:** puedes aceptar o rechazar las cookies no esenciales desde el aviso
que se muestra al entrar en el sitio, así como borrar las cookies almacenadas
desde la configuración de tu navegador.`
  }
}

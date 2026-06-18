import LegalLayout from '@/components/landing/LegalLayout'

export const metadata = { title: 'Política de Privacidad — RP Restaurantes' }

export default function PrivacidadPage() {
  return (
    <LegalLayout titulo="Política de Privacidad" actualizado="junio 2025">
      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li><strong>Responsable:</strong> RP Restaurantes</li>
        <li><strong>Finalidad:</strong> Prestación del servicio de software de gestión para hostelería</li>
        <li><strong>Contacto:</strong> hola@rp-restaurantes.com</li>
      </ul>

      <h2>2. Datos que recogemos</h2>
      <p>RP Restaurantes trata los siguientes datos personales:</p>
      <ul>
        <li><strong>Datos de contacto:</strong> nombre, correo electrónico, teléfono y nombre del negocio,
        facilitados al rellenar el formulario de contacto o al contratar el servicio.</li>
        <li><strong>Datos de cuenta:</strong> credenciales de acceso y configuración del negocio introducidos
        por el propio usuario durante el uso de la plataforma.</li>
        <li><strong>Datos de uso:</strong> información técnica sobre el acceso al Sitio (dirección IP,
        tipo de navegador, páginas visitadas) recogida automáticamente.</li>
      </ul>

      <h2>3. Finalidades y base jurídica</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#F6F7FB' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Finalidad</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Base jurídica</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Atender solicitudes de contacto y ventas', 'Interés legítimo / consentimiento del interesado'],
            ['Gestionar la relación contractual con clientes', 'Ejecución de contrato (art. 6.1.b RGPD)'],
            ['Enviar comunicaciones comerciales propias', 'Consentimiento del interesado'],
            ['Cumplir obligaciones legales', 'Obligación legal (art. 6.1.c RGPD)'],
          ].map(([fin, base], i) => (
            <tr key={i}>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8' }}>{fin}</td>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8', color: '#5B6477' }}>{base}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>4. Conservación de los datos</h2>
      <p>
        Los datos de contacto se conservan durante el tiempo necesario para atender la solicitud y,
        posteriormente, durante los plazos de prescripción legales aplicables. Los datos de clientes
        activos se mantienen mientras dure la relación contractual y, tras su finalización, durante el
        período exigido por la normativa fiscal y mercantil (mínimo 5 años).
      </p>

      <h2>5. Destinatarios</h2>
      <p>
        RP Restaurantes no cede datos personales a terceros salvo obligación legal. Utiliza proveedores
        de servicios (infraestructura cloud, procesamiento de pagos) que actúan como encargados del
        tratamiento bajo contrato con las garantías exigidas por el RGPD.
      </p>

      <h2>6. Derechos del interesado</h2>
      <p>
        En virtud del RGPD y la LOPDGDD, el interesado puede ejercer los siguientes derechos dirigiendo
        un escrito a <strong>hola@rp-restaurantes.com</strong>, acreditando su identidad:
      </p>
      <ul>
        <li><strong>Acceso:</strong> conocer qué datos se tratan sobre su persona.</li>
        <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
        <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
        <li><strong>Oposición:</strong> oponerse al tratamiento basado en interés legítimo.</li>
        <li><strong>Limitación:</strong> solicitar la restricción del tratamiento en determinados supuestos.</li>
        <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado y legible por máquina.</li>
      </ul>
      <p>
        Asimismo, tiene derecho a presentar una reclamación ante la Agencia Española de Protección de
        Datos (AEPD) en <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        RP Restaurantes aplica medidas técnicas y organizativas adecuadas para proteger los datos
        personales frente a accesos no autorizados, pérdida, alteración o divulgación, de acuerdo con
        el artículo 32 del RGPD.
      </p>

      <h2>8. Cambios en esta política</h2>
      <p>
        RP Restaurantes se reserva el derecho a modificar esta Política de Privacidad para adaptarla
        a cambios normativos o de servicio. Los cambios relevantes se comunicarán a los usuarios con
        antelación razonable.
      </p>
    </LegalLayout>
  )
}

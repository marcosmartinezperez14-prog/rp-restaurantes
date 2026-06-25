import LegalLayout from '@/components/landing/LegalLayout'

export const metadata = { title: 'Política de Cookies — GestionBar' }

export default function CookiesPage() {
  return (
    <LegalLayout titulo="Política de Cookies" actualizado="junio 2025">
      <h2>1. ¿Qué son las cookies?</h2>
      <p>
        Las cookies son pequeños archivos de texto que los sitios web almacenan en el navegador del
        usuario al visitar una página. Se utilizan para que el sitio funcione correctamente, para
        recordar preferencias y para obtener información estadística sobre el uso.
      </p>

      <h2>2. Cookies que utiliza este sitio</h2>

      <h3>Cookies estrictamente necesarias</h3>
      <p>
        Son imprescindibles para el funcionamiento del Sitio. Sin ellas, el servicio no puede prestarse
        correctamente. No requieren consentimiento.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#F6F7FB' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Cookie</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Finalidad</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Duración</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['sb-access-token', 'Sesión de usuario autenticado', 'Sesión'],
            ['sb-refresh-token', 'Renovación del token de sesión', '7 días'],
            ['sb-onboarding', 'Estado del proceso de alta', '1 año'],
          ].map(([name, fin, dur], i) => (
            <tr key={i}>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8', fontFamily: 'monospace', fontSize: 13 }}>{name}</td>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8' }}>{fin}</td>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8', color: '#5B6477' }}>{dur}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Cookies de análisis y rendimiento</h3>
      <p>
        Permiten conocer cómo los usuarios interactúan con el Sitio de forma agregada y anónima, para
        mejorar su funcionamiento. Se instalan únicamente con el consentimiento del usuario.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#F6F7FB' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Cookie</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Proveedor</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Finalidad</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', border: '1px solid #EEF1F8' }}>Duración</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['_vercel_insights', 'Vercel', 'Métricas de rendimiento y visitas', '1 año'],
          ].map(([name, prov, fin, dur], i) => (
            <tr key={i}>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8', fontFamily: 'monospace', fontSize: 13 }}>{name}</td>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8', color: '#5B6477' }}>{prov}</td>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8' }}>{fin}</td>
              <td style={{ padding: '10px 14px', border: '1px solid #EEF1F8', color: '#5B6477' }}>{dur}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. Gestión y retirada del consentimiento</h2>
      <p>
        El usuario puede gestionar, bloquear o eliminar las cookies en cualquier momento desde la
        configuración de su navegador:
      </p>
      <ul>
        <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
        <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
        <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
        <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
      </ul>
      <p>
        La retirada del consentimiento para cookies no necesarias no afecta al funcionamiento esencial
        del Sitio ni a la licitud del tratamiento previo al consentimiento.
      </p>

      <h2>4. Transferencias internacionales</h2>
      <p>
        Algunos proveedores de cookies pueden transferir datos fuera del Espacio Económico Europeo.
        En tal caso, se garantiza la existencia de garantías adecuadas (Cláusulas Contractuales Tipo u
        otros mecanismos aprobados por la Comisión Europea).
      </p>

      <h2>5. Más información</h2>
      <p>
        Para cualquier duda sobre el uso de cookies, puede contactar con nosotros en{' '}
        <a href="mailto:hola@gestionbar.com">hola@gestionbar.com</a>. Puede consultar también
        nuestra <a href="/privacidad">Política de Privacidad</a>.
      </p>
    </LegalLayout>
  )
}

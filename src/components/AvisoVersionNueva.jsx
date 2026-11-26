import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Cuando se publica una mejora (nuevo despliegue en Vercel), avisa "Hay una versión nueva" con un botón
// para actualizar, sin tener que cerrar ni recargar a mano. Compara la versión de este código (__VERSION__,
// la fija vite.config.js en cada build) con /version.json del servidor: al volver a la pestaña y cada 5 min.
const VERSION_APP = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

export default function AvisoVersionNueva() {
  const [nueva, setNueva] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    let vivo = true;
    const revisar = () => {
      if (document.visibilityState === 'hidden') return;
      fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (vivo && d?.version && d.version !== VERSION_APP) setNueva(true); })
        .catch(() => {});
    };
    const t = setInterval(revisar, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', revisar);
    window.addEventListener('focus', revisar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', revisar); window.removeEventListener('focus', revisar); };
  }, []);
  if (!nueva) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[1000] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-solid border-primary/40 bg-card px-4 py-3 text-sm shadow-lg">
      <Sparkles size={16} className="text-primary" />
      <span><strong>Hay una versión nueva de la app.</strong> Guarda lo que estés haciendo y actualiza.</span>
      <Button size="sm" onClick={() => window.location.reload()}>Actualizar</Button>
      <Button size="sm" variant="ghost" onClick={() => setNueva(false)}>Después</Button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Check, FileText, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { esImagen, girarArchivo } from '../archivos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Antes de subir: muestra cada foto (ya enderezada según la marca del celular) para que quien la
// sube confirme que se lee derecha, y la gire con ⟲ ⟳ si quedó torcida. Los PDF y documentos se
// listan sin cambios.
export default function RevisarFotos({ archivos, onConfirmar, onCancelar }) {
  const [giros, setGiros] = useState(() => archivos.map(() => 0));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Las URLs se crean y se liberan en el mismo efecto (así sobreviven al doble montaje de React).
  const [urls, setUrls] = useState(() => archivos.map(() => null));
  useEffect(() => {
    const creadas = archivos.map(a => (esImagen(a) ? URL.createObjectURL(a) : null));
    setUrls(creadas);
    return () => creadas.forEach(u => u && URL.revokeObjectURL(u));
  }, [archivos]);

  const girar = (i, d) => setGiros(g => g.map((x, j) => (j === i ? (x + d + 360) % 360 : x)));
  const fotos = archivos.filter(esImagen).length;

  const confirmar = async () => {
    setGuardando(true);
    setError('');
    try {
      const finales = [];
      for (let i = 0; i < archivos.length; i++) {
        finales.push(esImagen(archivos[i]) ? await girarArchivo(archivos[i], giros[i]) : archivos[i]);
      }
      onConfirmar(finales);
    } catch (e) {
      setError('No se pudo girar la foto: ' + e.message);
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !guardando) onCancelar(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>📷 Revisa {fotos === 1 ? 'la foto' : `las ${fotos} fotos`} antes de subir</DialogTitle>
          <DialogDescription>Verifica que se lean derechas. Si alguna quedó de lado o al revés, gírala con ⟲ ⟳.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          {archivos.map((a, i) => (
            <div key={`${a.name}${i}`} className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-background p-3">
              {esImagen(a) ? (urls[i] ? (
                <div className="flex h-56 items-center justify-center overflow-hidden rounded-md bg-muted">
                  <img src={urls[i]} alt={a.name} className="max-h-full max-w-full object-contain transition-transform"
                    style={{ transform: `rotate(${giros[i]}deg)${giros[i] % 180 ? ' scale(0.75)' : ''}` }} />
                </div>
              ) : <div className="h-56 rounded-md bg-muted" />) : (
                <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-md bg-muted text-muted-foreground">
                  <FileText size={36} />
                  <span className="text-xs">Se sube tal cual</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={a.name}>{a.name}</span>
                <span className="text-xs text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                {esImagen(a) && (
                  <>
                    <Button variant="outline" size="icon" className="size-8" onClick={() => girar(i, -90)} aria-label="Girar a la izquierda" title="Girar a la izquierda"><RotateCcw size={15} /></Button>
                    <Button variant="outline" size="icon" className="size-8" onClick={() => girar(i, 90)} aria-label="Girar a la derecha" title="Girar a la derecha"><RotateCw size={15} /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="items-center">
          {error && <p className="m-0 mr-auto text-sm text-destructive">{error}</p>}
          <Button variant="outline" disabled={guardando} onClick={onCancelar}>Cancelar</Button>
          <Button disabled={guardando} onClick={confirmar}>
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Se ven bien, usar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

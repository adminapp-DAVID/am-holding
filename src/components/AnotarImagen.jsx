import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Editor para marcar una captura antes de adjuntarla a un ticket de soporte (adaptado de Noss App):
// flecha, recuadro, lápiz, texto y resaltar, con colores y deshacer.
const HERRAMIENTAS = [
  { clave: 'flecha', nombre: '↗ Flecha' },
  { clave: 'rect', nombre: '▭ Recuadro' },
  { clave: 'lapiz', nombre: '✎ Lápiz' },
  { clave: 'texto', nombre: 'T Texto' },
  { clave: 'resaltar', nombre: '▮ Resaltar' },
];
const COLORES = ['#e5484d', '#f5a524', '#30a46c', '#3e63dd', '#111111', '#ffffff'];

// Grosor proporcional al tamaño de la imagen (se ve igual en capturas grandes o pequeñas).
const grosorBase = (w) => Math.max(3, Math.round(w / 300));

function dibujar(ctx, f, base) {
  ctx.save();
  ctx.strokeStyle = f.color;
  ctx.fillStyle = f.color;
  ctx.lineWidth = base;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (f.tipo === 'lapiz') {
    ctx.beginPath();
    f.puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  } else if (f.tipo === 'rect') {
    ctx.strokeRect(f.x1, f.y1, f.x2 - f.x1, f.y2 - f.y1);
  } else if (f.tipo === 'resaltar') {
    ctx.globalAlpha = 0.3;
    ctx.fillRect(f.x1, f.y1, f.x2 - f.x1, f.y2 - f.y1);
  } else if (f.tipo === 'flecha') {
    const ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
    const punta = base * 5;
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    ctx.lineTo(f.x2 - Math.cos(ang) * punta * 0.6, f.y2 - Math.sin(ang) * punta * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(f.x2, f.y2);
    ctx.lineTo(f.x2 - punta * Math.cos(ang - 0.45), f.y2 - punta * Math.sin(ang - 0.45));
    ctx.lineTo(f.x2 - punta * Math.cos(ang + 0.45), f.y2 - punta * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  } else if (f.tipo === 'texto') {
    const tam = base * 7;
    ctx.font = `bold ${tam}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    // contorno para que se lea sobre cualquier fondo
    ctx.lineWidth = base * 1.2;
    ctx.strokeStyle = f.color === '#ffffff' ? '#111111' : '#ffffff';
    ctx.strokeText(f.texto, f.x1, f.y1);
    ctx.fillText(f.texto, f.x1, f.y1);
  }
  ctx.restore();
}

export default function AnotarImagen({ archivo, onGuardar, onCerrar }) {
  const canvas = useRef(null);
  const [img, setImg] = useState(null);
  const [figuras, setFiguras] = useState([]);
  const [actual, setActual] = useState(null);
  const [herramienta, setHerramienta] = useState('flecha');
  const [color, setColor] = useState(COLORES[0]);
  const [texto, setTexto] = useState(null); // { x, y, valor } mientras se escribe

  useEffect(() => {
    const url = URL.createObjectURL(archivo);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const repintar = useCallback(() => {
    const c = canvas.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const base = grosorBase(img.naturalWidth);
    [...figuras, actual].filter(Boolean).forEach((f) => dibujar(ctx, f, base));
  }, [img, figuras, actual]);
  useEffect(repintar, [repintar]);

  // Coordenadas del puntero en píxeles reales de la imagen.
  const punto = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.current.width, ((e.clientY - r.top) / r.height) * canvas.current.height];
  };

  function bajar(e) {
    if (!img) return;
    const [x, y] = punto(e);
    if (herramienta === 'texto') {
      setTexto({ x, y, valor: '' });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setActual(herramienta === 'lapiz' ? { tipo: 'lapiz', color, puntos: [[x, y]] } : { tipo: herramienta, color, x1: x, y1: y, x2: x, y2: y });
  }
  function mover(e) {
    if (!actual) return;
    const [x, y] = punto(e);
    setActual((f) => (f.tipo === 'lapiz' ? { ...f, puntos: [...f.puntos, [x, y]] } : { ...f, x2: x, y2: y }));
  }
  function soltar() {
    if (!actual) return;
    const valido = actual.tipo === 'lapiz' ? actual.puntos.length > 1 : Math.hypot(actual.x2 - actual.x1, actual.y2 - actual.y1) > 4;
    if (valido) setFiguras((fs) => [...fs, actual]);
    setActual(null);
  }
  function ponerTexto(e) {
    e.preventDefault();
    if (texto?.valor.trim()) setFiguras((fs) => [...fs, { tipo: 'texto', color, x1: texto.x, y1: texto.y, texto: texto.valor.trim() }]);
    setTexto(null);
  }

  function guardar() {
    canvas.current.toBlob((blob) => {
      const nombre = (archivo.name || 'captura').replace(/\.[^.]+$/, '') + '.png';
      onGuardar(new File([blob], nombre, { type: 'image/png' }));
    }, 'image/png');
  }

  const claseHerramienta = (activa) => cn('cursor-pointer rounded-md border border-solid px-2.5 py-1 text-xs font-semibold',
    activa ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted');

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Marcar la captura</DialogTitle>
          <DialogDescription>Señala dónde está el problema: flechas, recuadros, texto…</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {HERRAMIENTAS.map((h) => (
              <button key={h.clave} type="button" className={claseHerramienta(herramienta === h.clave)} onClick={() => setHerramienta(h.clave)}>{h.nombre}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {COLORES.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)}
                className={cn('h-6 w-6 cursor-pointer rounded-full border-2 border-solid p-0', color === c ? 'border-foreground' : 'border-border')}
                style={{ background: c }} />
            ))}
          </div>
          <div className="flex gap-1">
            <button type="button" className={claseHerramienta(false)} onClick={() => setFiguras((fs) => fs.slice(0, -1))} disabled={!figuras.length}>↶ Deshacer</button>
            <button type="button" className={claseHerramienta(false)} onClick={() => setFiguras([])} disabled={!figuras.length}>Borrar todo</button>
          </div>
        </div>
        {texto && (
          <form className="flex gap-2" onSubmit={ponerTexto}>
            <Input autoFocus value={texto.valor} onChange={(e) => setTexto((t) => ({ ...t, valor: e.target.value }))} placeholder="Escribe el texto y pulsa Enter" />
            <Button type="submit" size="sm">Poner</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setTexto(null)}>Cancelar</Button>
          </form>
        )}
        <div className="max-h-[60vh] overflow-auto rounded-md border border-solid border-border bg-muted">
          {img ? (
            <canvas ref={canvas} width={img.naturalWidth} height={img.naturalHeight}
              className={cn('block h-auto w-full touch-none', herramienta === 'texto' ? 'cursor-text' : 'cursor-crosshair')}
              onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} />
          ) : <p className="m-0 p-6 text-center text-sm text-muted-foreground">Cargando imagen…</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button type="button" onClick={guardar} disabled={!img}>Usar esta imagen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

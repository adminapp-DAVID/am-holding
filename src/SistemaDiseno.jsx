import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';
import './index.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge, estadoBadge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import logoAmHolding from './assets/logos/logo-am-holding.png';
import logoNoss from './assets/logos/logo-noss.png';
import logoProGlobal from './assets/logos/logo-pro-global.png';
import logoForSeven from './assets/logos/logo-for-seven.png';
import logoPronova from './assets/logos/logo-pronova.png';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';

// Catálogo de componentes (etapa 2 del sistema de diseño). Página aparte, sin login ni datos
// reales: /sistema-diseno.html. Sirve para revisar los componentes antes de migrar módulos.

const FILAS = [
  { fecha: '2026-10-01', concepto: 'Honorarios septiembre', empresa: 'AM SPORTS GROUP SAS', valor: '$ 3.500.000', estado: 'Pagado' },
  { fecha: '2026-10-05', concepto: 'Viáticos Bogotá', empresa: 'PRONOVA CAPITAL SAS', valor: '$ 820.000', estado: 'Aprobado' },
  { fecha: '2026-10-09', concepto: 'Publicidad redes', empresa: 'FOR SEVEN MEDIA SAS', valor: 'US$ 450', estado: 'Pendiente' },
  { fecha: '2026-10-12', concepto: 'Compra equipos', empresa: 'PRO INVESTMENTS GLOBAL SAS', valor: '$ 1.250.000', estado: 'Devuelto' },
];

const LOGOS = {
  'AM SPORTS GROUP SAS': logoNoss,
  'PRO INVESTMENTS GLOBAL SAS': logoProGlobal,
  'FOR SEVEN MEDIA SAS': logoForSeven,
  'PRONOVA CAPITAL SAS': logoPronova,
};

const Seccion = ({ titulo, children }) => (
  <section className="flex flex-col gap-3">
    <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
    {children}
  </section>
);

function SistemaDiseno() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <img src={logoAmHolding} alt="AM HOLDING" className="h-14 w-auto self-start object-contain" />
          <h1 className="m-0 text-2xl font-extrabold">Sistema de diseño · AM Holding</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Componentes base (shadcn/ui) con la paleta de la app. Solo muestra, sin datos reales.</p>
        </header>

        <Seccion titulo="Logos de las empresas">
          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(LOGOS).map(([empresa, src]) => (
              <Card key={empresa} className="items-center gap-2 px-5 py-4">
                <img src={src} alt={empresa} className="h-10 w-auto max-w-40 object-contain" />
                <span className="text-xs font-semibold text-muted-foreground">{empresa}</span>
              </Card>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Botones">
          <div className="flex flex-wrap gap-2">
            <Button><Plus size={16} /> Nueva solicitud</Button>
            <Button variant="success"><Check size={16} /> Aprobar</Button>
            <Button variant="destructive"><Trash2 size={16} /> Eliminar</Button>
            <Button variant="outline"><Pencil size={16} /> Editar</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="link">Enlace</Button>
            <Button disabled>Deshabilitado</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Pequeño</Button>
            <Button>Normal</Button>
            <Button size="lg">Grande</Button>
            <Button size="icon" variant="outline" aria-label="Editar"><Pencil size={16} /></Button>
          </div>
        </Seccion>

        <Seccion titulo="Etiquetas de estado">
          <div className="flex flex-wrap gap-2">
            {['Pendiente', 'Aprobado', 'Pagado', 'Legalizado', 'Devuelto', 'Rechazado'].map(e => (
              <Badge key={e} variant={estadoBadge(e)}>{e}</Badge>
            ))}
            <Badge>Dorado</Badge>
            <Badge variant="outline">⚪ Gasto Neutro</Badge>
          </div>
        </Seccion>

        <Seccion titulo="Formulario en tarjeta">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Nueva solicitud</CardTitle>
              <CardDescription>Los campos con * son obligatorios.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-tipo">Tipo *</Label>
                <Select id="d-tipo" defaultValue="">
                  <option value="" disabled>Selecciona…</option>
                  <option>Anticipo</option>
                  <option>Reembolso</option>
                  <option>Pago a Tercero</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-valor">Valor *</Label>
                <Input id="d-valor" inputMode="numeric" placeholder="$ 0" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="d-concepto">Concepto *</Label>
                <Textarea id="d-concepto" placeholder="Describe el gasto" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="d-error">Campo con error</Label>
                <Input id="d-error" aria-invalid="true" defaultValue="Valor inválido" />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="outline">Cancelar</Button>
              <Button>Guardar</Button>
            </CardFooter>
          </Card>
        </Seccion>

        <Seccion titulo="Tarjetas de resumen">
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Ingresos', '$ 48.200.000', 'text-success'], ['Gastos', '$ 31.750.000', 'text-destructive'], ['Saldo', '$ 16.450.000', 'text-foreground']].map(([t, v, c]) => (
              <Card key={t} className="gap-1">
                <CardContent>
                  <p className="m-0 text-xs font-semibold uppercase text-muted-foreground">{t}</p>
                  <p className={`m-0 text-xl font-extrabold ${c}`}>{v}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Tabla">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FILAS.map(f => (
                <TableRow key={f.concepto}>
                  <TableCell className="whitespace-nowrap">{f.fecha}</TableCell>
                  <TableCell>{f.concepto}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <img src={LOGOS[f.empresa]} alt="" className="h-[18px] w-auto max-w-20 object-contain" />
                      {f.empresa}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">{f.valor}</TableCell>
                  <TableCell><Badge variant={estadoBadge(f.estado)}>{f.estado}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Seccion>

        <Seccion titulo="Ventana modal">
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button variant="outline" className="self-start">Abrir ventana de confirmación</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar pago</DialogTitle>
                <DialogDescription>Revisa los datos antes de marcar la solicitud como pagada.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-cop">Valor pagado (COP) *</Label>
                <Input id="d-cop" placeholder="$ 0" />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button variant="success" onClick={() => setAbierto(false)}>Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Seccion>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><SistemaDiseno /></React.StrictMode>);

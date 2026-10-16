# Kit: sistema de Soporte (tickets) — copiado de Noss App

Este kit trae el sistema de soporte que ya funciona en Noss App, para implementarlo en AM Holding.
En `original/` están los archivos **tal cual** están en Noss (sirven de referencia; no se importan directo).

## Qué hace

- Botón de soporte en la barra superior: abre el formulario con la pantalla actual ya indicada.
- Tipos: Error, Mejora, Nueva función, Duda, Datos. Prioridad, módulo, descripción y adjuntos.
- "Capturar esta pantalla" (html-to-image, excluye el modal) y "Marcar" (`AnotarImagen`: flecha, recuadro, lápiz, texto, resaltar, colores, deshacer). El PNG marcado se adjunta.
- Antes de enviar muestra tickets parecidos para no repetir; "a mí también" (apoyos).
- Lista `/soporte` con filtros y resumen por estado; detalle del ticket con comentarios e historial.
- Estados: Nuevo → En revisión / Necesita información → Aprobado → En desarrollo → Publicado / Rechazado.
- Todos ven todos los tickets; solo quien gestiona cambia estado, prioridad y respuesta (trigger `tickets_antes`).
- Avisos en la campana a gestores, autor, quienes apoyan y quienes comentan.
- Edge Function `soporte-github`: al aprobar crea el issue `[Soporte #N] …` (label `soporte`) en GitHub; al publicar o rechazar lo cierra.

## Archivos originales

| Archivo | Qué es |
|---|---|
| `original/supabase/0025_soporte.sql` | Tablas `tickets`, `ticket_comentarios`, `ticket_apoyos`, `ticket_historial`, triggers, RLS y bucket `soporte` (en AM: `tickets-adjuntos`) |
| `original/supabase/soporte-github/index.ts` | Edge Function que crea/cierra issues en GitHub |
| `original/src/lib/soporte.js` | Constantes (tipos, estados, módulos), `parecidos`, `abrirAdjunto`, `sincronizarGitHub` |
| `original/src/components/TicketForm.jsx` | Formulario (nuevo/editar) con captura y adjuntos |
| `original/src/components/AnotarImagen.jsx` | Editor para marcar la captura (canvas) |
| `original/src/pages/Soporte.jsx` | Lista de tickets |
| `original/src/pages/TicketDetalle.jsx` | Detalle, comentarios, historial, gestión |
| `original/src/soporte.css` | Estilos (variables `--verde`, `--borde`, `--surface`, `--texto`, `--bg`, `--peligro`, `--activo-bg/fg`, `--verde-suave`) |

## Diferencias con AM Holding (adaptar)

1. **Permisos.** Noss usa `tiene_permiso('soporte.ver' | 'soporte.crear' | 'soporte.gestionar')` y en React `puede()`. AM Holding usa roles fijos (`current_rol()` en SQL; `canApprove`, `isReadOnly`… en React). Reemplazar:
   - ver / crear / comentar / apoyar → cualquier usuario activo: `public.current_usuario_id() is not null`.
   - gestionar → `public.current_rol() in ('Administrador', 'Gerente')` (confirmar con el usuario quiénes gestionan). Crear una función `public.gestiona_soporte()` y usarla en RLS, en `tickets_antes`, en `gestores_soporte()` y en la Edge Function (en lugar de `mis_permisos`, llamar `rpc('gestiona_soporte')`).
   - Quitar el `insert into public.permisos …` del SQL (AM no tiene esa tabla).
2. **Notificaciones.** Noss tiene `public.notificaciones` + `notificar()` + campana con Realtime. Si AM Holding no tiene campana, crear lo mínimo: tabla `notificaciones (id, usuario_id, tipo, titulo, mensaje, enlace, ref_key, leida, created_at)` con unique `(usuario_id, ref_key)`, la función `notificar()` (security definer, revoke a public/anon/authenticated), RLS "cada quien ve y marca las suyas" y un componente campana con Supabase Realtime. Si no se quiere campana, borrar las llamadas a `notificar()`.
3. **Navegación.** Noss usa `react-router-dom` (`Link`, `useNavigate`, `useParams`, rutas `/soporte` y `/soporte/:id`). AM Holding es CRA con casi todo en `src/App.js` y navegación por estado: agregar una vista "Soporte" en el menú y manejar el ticket abierto con estado (`ticketId`). Los `enlace` de las notificaciones (`/soporte/ID`) deben llevar a esa vista.
4. **Auth.** Reemplazar `useAuth()` (`usuario`, `puede`) por el usuario actual que ya maneja AM Holding.
5. **Helpers que no existen en AM:** `formatoFecha`, `formatoFechaHora`, `fechaEnZona`, `nombreSeguro` (limpia nombres de archivo), `Modal`, `Icon`. Crearlos o usar los equivalentes del proyecto.
6. **Dependencia:** `npm install html-to-image` (solo para "Capturar esta pantalla"; se carga diferido con `import()`).
7. **Módulos:** cambiar `MODULOS_SOPORTE` por los de AM Holding (p. ej. Solicitudes, Pagos, Traslados, Cuentas, Reportes, Configuración, General).
8. **Migraciones:** AM usa nombres `supabase/migrations/AAAAMMDD_nombre.sql`. En SQL nunca comparar `auth.uid()` con `usuarios.id` (usar `current_usuario_id()`). Revisar que existan `current_usuario_id()` y `current_rol()`.
9. **Supabase:** un `.update()`/`.delete()` sin `.select('id')` devuelve `error: null` aunque RLS bloquee: el código original ya usa `.select(...)` y verifica `data.length`; mantenerlo.
10. **Diseño:** AM Holding usa Vite + Tailwind v4 + shadcn/ui (`src/components/ui/`: Button, Input, Textarea, Select, Label, Card, Badge `estadoBadge`, Table, Dialog). Usar esos componentes en lugar de `Modal` y de las clases de `soporte.css`; el CSS original es solo referencia visual (sus variables `--verde`, `--borde`… no existen en AM).
11. **Ojo con los nombres:** en AM Holding "soportes" ya significa los comprobantes de pagos (bucket `soportes` + tabla `public.soportes`). Para no mezclarlos, usar el bucket **`tickets-adjuntos`** (no `soporte`) y llamar al módulo "Soporte técnico" / "Ayuda" en la interfaz.
12. **Antes de subir:** `npm run lint`, `npm test` y `npm run build` sin errores ni warnings.

## Configuración en Supabase y GitHub (la hace el usuario)

1. Ejecutar la migración en el SQL Editor.
2. Edge Function `soporte-github`: Supabase → Edge Functions → "Deploy a new function" → Via Editor, pegar `index.ts`, **Verify JWT desactivado** (la función valida al usuario).
3. Secretos (Supabase → Edge Functions → Secrets), **nunca pegarlos en el chat**:
   - `GITHUB_TOKEN`: token fine-grained de GitHub, solo el repositorio `adminapp-DAVID/am-holding`, permiso **Issues: Read and write**.
   - `GITHUB_REPO`: `adminapp-DAVID/am-holding`
   - `APP_URL` (opcional): la URL de AM Holding en Vercel, para el enlace al ticket.
4. Flujo de trabajo: las peticiones aprobadas se atienden desde los issues; el PR menciona "Ticket #N" y, tras el merge, el ticket se marca Publicado en la app.

## Mensaje para pegar en la conversación de AM Holding

```
Quiero implementar en AM Holding el sistema de soporte (tickets) que hicimos en Noss App.
Está todo en la rama claude/vigilant-wright-15c3r0 del repo am-holding, carpeta docs/kit-soporte/
(lee primero docs/kit-soporte/LEEME.md; en original/ están los archivos de Noss como referencia).
Adáptalo a AM Holding siguiendo la sección "Diferencias con AM Holding": permisos por rol
(gestionan Administrador y Gerente), campana de notificaciones mínima si no existe, navegación por
estado en App.js, componentes shadcn/ui, bucket tickets-adjuntos (no confundir con los soportes de pagos),
módulos de AM Holding y migración con el formato de fecha del proyecto.
Hazlo en una rama + PR, valida el SQL y corre npm run lint, npm test y npm run build antes de subir.
Al final dime qué SQL correr y cómo configurar la Edge Function soporte-github y sus secretos.
```

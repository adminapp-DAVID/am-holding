# AM Holding — guía para Claude

App React (Create React App) de gestión financiera de la holding (AM SPORTS GROUP SAS, PRO INVESTMENTS GLOBAL SAS, PRONOVA CAPITAL SAS, FOR SEVEN MEDIA SAS, ARKO). Casi todo el código está en `src/App.js`. Backend: Supabase (Postgres + Auth + Storage, RLS activo). Deploy: Vercel automático en cada push a `main`.

## Estilo de respuesta

- Respuestas en español, muy concisas. Pocas preguntas aclaratorias, directas.

## Flujo de despliegue (obligatorio)

- **Por defecto: PR.** Todo cambio de lógica, datos, permisos/roles, Supabase/RLS, cálculos, soportes o formularios va en una rama + Pull Request. El usuario aprueba y hace el merge.
- **Push directo a `main`: solo cambios pequeños de UI/visuales** (textos, colores, estilos, posición o apariencia de botones) que no cambien el comportamiento. Avisar al usuario cada vez que se haga.
- Si hay duda sobre si un cambio es "solo visual", va por PR.
- Antes de subir, correr `npm run build` para confirmar que compila.

## Notas técnicas clave

- Roles: Administrador, Coordinadora Administrativa, Contadora, Gerente, Responsable, Colaborador. Permisos vía `canApprove`, `canEdit`, `isReadOnly`, `puedeEditarSolicitud(s)`.
- Supabase: un `.update()`/`.delete()` sin `.select()` devuelve `error: null` aunque RLS bloquee el cambio (0 filas). Usar `.select('id')` y verificar `data.length`.
- En SQL/RLS usar `current_usuario_id()` / `current_rol()`. **Nunca** comparar `auth.uid()` contra `usuarios.id` (el vínculo es `usuarios.auth_user_id`).
- Soportes: bucket `soportes` + tabla `public.soportes` (sin columna mime; se infiere con `inferirMimePorExtension`). Un mismo `bucket_path` puede estar compartido entre entidades: borrar/fusionar con `eliminarSoportesDeEntidad` y `fusionarSoportesEdicion`.
- Traslados a empresa externa usan el sentinel `CUENTA_DESTINO_EXTERNA = 'Empresa Externa'` (sin ":" para no activar la lógica de doble moneda).
- Seguridad: nunca automatizar login a portales bancarios con credenciales guardadas.

// Cliente de Supabase — usado en toda la app para Auth y datos.
// La URL y la llave anon NUNCA se escriben aquí directo: se toman de
// variables de entorno (REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY),
// configuradas en Vercel (Settings → Environment Variables) y en un
// archivo .env local (que no se sube a git) para pruebas.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Faltan las variables de entorno REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

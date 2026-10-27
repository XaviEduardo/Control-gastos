// Cliente único de Supabase (Fase 1 — ver docs/decisions.md). La "anon public" key es segura
// de exponer en el navegador: el acceso real está controlado por Row Level Security
// (supabase/schema.sql), no por mantener esta key en secreto.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://mwllhdomuwlhttgbgdzb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bGxoZG9tdXdsaHR0Z2JnZHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMDkxMTIsImV4cCI6MjEwODY4NTExMn0.oHVIUftpTV_CzU5OFnqvg03vrDITAit6PUzurFwyEWM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

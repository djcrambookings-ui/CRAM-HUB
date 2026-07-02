import { createClient } from "@supabase/supabase-js";

// From Vercel Environment Variables:
//   VITE_SUPABASE_URL       = your Project URL
//   VITE_SUPABASE_ANON_KEY  = your anon/publishable key
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only connect if both values exist, so the app still loads (showing a clear
// message) even before they're added in Vercel.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

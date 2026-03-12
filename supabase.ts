import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vccdsvehqslxqnnpjrqa.supabase.co"; // ← ta Project URL
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjY2RzdmVocXNseHFubnBqcnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjIzMjMsImV4cCI6MjA4ODg5ODMyM30.LT_MhttA8cSDfZrMve43xC8E4S6Zu9zyQgKVtnaM1DI"; // ← ta anon public key

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

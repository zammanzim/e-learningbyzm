
// Cek dulu: "Eh, supabase udah ada belum?"
// Kalau belum ada, baru kita buat. Kalau udah ada, pake yang lama.
if (typeof window.supabaseClient === 'undefined') {

    const SUPABASE_URL = "https://vttmwtlqzbbiaromohrp.supabase.co";
    const SUPABASE_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY";

    // Kita tempel langsung ke WINDOW biar jadi Global Variable yang aman
    // Perhatikan: gw ganti nama variabelnya jadi 'supabaseClient' biar ga bentrok sama librarynya
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log("✅ Supabase Connected!");
}
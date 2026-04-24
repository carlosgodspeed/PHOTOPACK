import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, photo_id, visitor_id } = await req.json();
    if (!token || !photo_id || !visitor_id) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: event } = await supabase.from("events").select("id, is_active, expires_at").eq("access_token", token).maybeSingle();
    if (!event || !event.is_active || new Date(event.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invalid event" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: photo } = await supabase.from("photos").select("id").eq("id", photo_id).eq("event_id", event.id).maybeSingle();
    if (!photo) return new Response(JSON.stringify({ error: "Photo not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: existing } = await supabase.from("favorites").select("id").eq("photo_id", photo_id).eq("visitor_id", visitor_id).maybeSingle();
    if (existing) {
      await supabase.from("favorites").delete().eq("id", existing.id);
      return new Response(JSON.stringify({ favorited: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      await supabase.from("favorites").insert({ photo_id, event_id: event.id, visitor_id });
      return new Response(JSON.stringify({ favorited: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

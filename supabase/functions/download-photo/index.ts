import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const photoId = url.searchParams.get("photo_id");
    if (!token || !photoId) return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: event } = await supabase.from("events").select("id, is_active, expires_at, allow_download, download_resolution").eq("access_token", token).maybeSingle();
    if (!event || !event.is_active || new Date(event.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invalid event" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!event.allow_download) return new Response(JSON.stringify({ error: "Download disabled" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: photo } = await supabase.from("photos").select("storage_path, original_path, filename").eq("id", photoId).eq("event_id", event.id).maybeSingle();
    if (!photo) return new Response(JSON.stringify({ error: "Photo not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const bucket = event.download_resolution === "original" ? "photos-original" : "photos";
    const path = event.download_resolution === "original" ? (photo.original_path ?? photo.storage_path) : photo.storage_path;
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 300, { download: photo.filename });

    return new Response(JSON.stringify({ url: signed?.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

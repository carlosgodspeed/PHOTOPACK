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
    const visitorId = url.searchParams.get("visitor_id") ?? null;
    if (!token) return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: event, error } = await supabase
      .from("events")
      .select("id, name, description, event_date, expires_at, is_active, allow_download, download_resolution, view_count")
      .eq("access_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!event) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!event.is_active) return new Response(JSON.stringify({ error: "Event inactive" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (new Date(event.expires_at) < new Date()) return new Response(JSON.stringify({ error: "Link expired" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: photos } = await supabase
      .from("photos")
      .select("id, storage_path, filename, taken_at, width, height")
      .eq("event_id", event.id)
      .order("taken_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    // Sign each photo's URL (1 hour validity)
    const photosWithUrls = await Promise.all((photos ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage.from("photos").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: signed?.signedUrl ?? null };
    }));

    // Get favorites for this visitor
    let favoriteIds: string[] = [];
    if (visitorId) {
      const { data: favs } = await supabase.from("favorites").select("photo_id").eq("event_id", event.id).eq("visitor_id", visitorId);
      favoriteIds = (favs ?? []).map(f => f.photo_id);
    }

    // Log view + increment counter
    await supabase.from("event_views").insert({ event_id: event.id, visitor_id: visitorId });
    await supabase.from("events").update({ view_count: (event.view_count ?? 0) + 1 }).eq("id", event.id);

    return new Response(JSON.stringify({ event, photos: photosWithUrls, favoriteIds }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Parse EXIF DateTimeOriginal from JPEG bytes (returns ISO string or null)
function parseExifDate(bytes: Uint8Array): string | null {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint16(0) !== 0xffd8) return null; // not JPEG
    let offset = 2;
    while (offset < dv.byteLength) {
      if (dv.getUint8(offset) !== 0xff) return null;
      const marker = dv.getUint8(offset + 1);
      const size = dv.getUint16(offset + 2);
      if (marker === 0xe1) {
        // APP1 - look for Exif\0\0
        const start = offset + 4;
        const exifHeader = new TextDecoder().decode(bytes.slice(start, start + 6));
        if (exifHeader.startsWith("Exif")) {
          const tiffStart = start + 6;
          const little = dv.getUint16(tiffStart) === 0x4949;
          const get16 = (o: number) => little ? dv.getUint16(o, true) : dv.getUint16(o);
          const get32 = (o: number) => little ? dv.getUint32(o, true) : dv.getUint32(o);
          const ifd0 = tiffStart + get32(tiffStart + 4);
          const numEntries = get16(ifd0);
          let exifIfdOffset = 0;
          for (let i = 0; i < numEntries; i++) {
            const entry = ifd0 + 2 + i * 12;
            if (get16(entry) === 0x8769) {
              exifIfdOffset = tiffStart + get32(entry + 8);
              break;
            }
          }
          if (!exifIfdOffset) return null;
          const exifEntries = get16(exifIfdOffset);
          for (let i = 0; i < exifEntries; i++) {
            const entry = exifIfdOffset + 2 + i * 12;
            const tag = get16(entry);
            if (tag === 0x9003 /* DateTimeOriginal */) {
              const valOffset = tiffStart + get32(entry + 8);
              const str = new TextDecoder().decode(bytes.slice(valOffset, valOffset + 19));
              // "YYYY:MM:DD HH:MM:SS"
              const m = str.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
              if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
            }
          }
          return null;
        }
      }
      offset += 2 + size;
    }
  } catch (_e) {
    return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const eventId = form.get("event_id") as string | null;
    const watermarkText = (form.get("watermark") as string | null) ?? "© Photographer";
    if (!file || !eventId) return new Response(JSON.stringify({ error: "Missing file or event_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const takenAt = parseExifDate(bytes);

    // Decode image
    const img = (await decode(bytes)) as Image;
    const w = img.width;
    const h = img.height;

    // Apply watermark - tiled diagonal text using built-in bitmap font
    const fontSize = Math.max(24, Math.floor(Math.min(w, h) / 30));
    let wmImage: Image | null = null;
    try {
      // ImageScript bundles a default font; renderText with no font arg uses it
      // @ts-ignore - signature accepts (size, text, color)
      wmImage = await Image.renderText(undefined, fontSize, watermarkText, 0xffffffaa);
    } catch (_e) {
      wmImage = null;
    }

    if (wmImage) {
      const stepX = wmImage.width + 200;
      const stepY = wmImage.height + 250;
      for (let y = -stepY; y < h + stepY; y += stepY) {
        for (let x = -stepX; x < w + stepX; x += stepX) {
          const offset = (Math.floor(y / stepY) % 2) * Math.floor(stepX / 2);
          img.composite(wmImage, x + offset, y);
        }
      }
    }

    const watermarkedBytes = await img.encodeJPEG(85);

    const baseName = `${eventId}/${crypto.randomUUID()}`;
    const ext = file.name.split(".").pop() ?? "jpg";
    const wmPath = `${baseName}.jpg`;
    const origPath = `${baseName}.${ext}`;

    const up1 = await supabase.storage.from("photos").upload(wmPath, watermarkedBytes, { contentType: "image/jpeg", upsert: false });
    if (up1.error) throw up1.error;

    const up2 = await supabase.storage.from("photos-original").upload(origPath, bytes, { contentType: file.type, upsert: false });
    if (up2.error) throw up2.error;

    const { data: photoRow, error: insertErr } = await supabase.from("photos").insert({
      event_id: eventId,
      storage_path: wmPath,
      original_path: origPath,
      filename: file.name,
      taken_at: takenAt,
      width: w,
      height: h,
      size_bytes: file.size,
    }).select().single();
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ photo: photoRow }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("upload-photo error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

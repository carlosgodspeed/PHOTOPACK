import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Photo {
  id: string;
  storage_path: string;
  filename: string;
  taken_at: string | null;
  created_at: string;
}

const EventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [photos, setPhotos] = useState<Array<Photo & { url?: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const load = useCallback(async () => {
    if (!id) return;
    const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
    setEvent(ev);
    const { data: ph } = await supabase.from("photos").select("*").eq("event_id", id).order("taken_at", { ascending: true, nullsFirst: false }).order("created_at");
    const photosList = (ph as Photo[]) ?? [];
    const withUrls = await Promise.all(photosList.map(async (p) => {
      const { data: signed } = await supabase.storage.from("photos").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: signed?.signedUrl };
    }));
    setPhotos(withUrls);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onDrop = useCallback(async (files: File[]) => {
    if (!id) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Sessão expirada"); setUploading(false); return; }

    let success = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("event_id", id);
        fd.append("watermark", "© Photo Cliente");
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-photo`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        success++;
      } catch (e: any) {
        console.error(e);
        toast.error(`Falha em ${file.name}: ${e.message}`);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setUploading(false);
    toast.success(`${success}/${files.length} fotos enviadas`);
    load();
  }, [id, load]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    disabled: uploading,
  });

  const removePhoto = async (p: Photo) => {
    if (!confirm("Excluir esta foto?")) return;
    await supabase.storage.from("photos").remove([p.storage_path]);
    if ((p as any).original_path) await supabase.storage.from("photos-original").remove([(p as any).original_path]);
    await supabase.from("photos").delete().eq("id", p.id);
    load();
  };

  if (!event) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Eventos
      </Link>

      <div>
        <h1 className="text-2xl font-medium">{event.name}</h1>
        <p className="text-sm text-muted-foreground">{photos.length} foto(s) · expira em {format(new Date(event.expires_at), "dd/MM/yyyy")}</p>
      </div>

      <Card className="p-6 space-y-4 border-l-4 border-l-accent">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-primary/5"} ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm">{isDragActive ? "Solte aqui..." : "Arraste fotos ou clique para selecionar"}</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP</p>
        </div>
        {uploading && (
          <div className="space-y-2">
            <Progress value={(progress.done / progress.total) * 100} />
            <p className="text-xs text-muted-foreground text-center">{progress.done}/{progress.total} processadas (marca d'água + EXIF)</p>
          </div>
        )}
      </Card>

      {photos.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nenhuma foto ainda
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group aspect-square overflow-hidden bg-muted rounded">
              {p.url && <img src={p.url} alt={p.filename} className="w-full h-full object-cover" loading="lazy" />}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2">
                <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 truncate max-w-[60%]">
                  {p.taken_at ? format(new Date(p.taken_at), "dd/MM/yy HH:mm") : "—"}
                </span>
                <button onClick={() => removePhoto(p)} className="opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground p-1.5 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventDetail;

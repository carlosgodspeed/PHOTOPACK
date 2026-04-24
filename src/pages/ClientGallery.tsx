import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Heart, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

interface Photo {
  id: string;
  url: string;
  filename: string;
  taken_at: string | null;
  width: number | null;
  height: number | null;
}

interface EventData {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  allow_download: boolean;
}

// Persistent visitor id
const getVisitorId = () => {
  let v = localStorage.getItem("visitor_id");
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem("visitor_id", v);
  }
  return v;
};

const ClientGallery = () => {
  const { token } = useParams();
  const [event, setEvent] = useState<EventData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showFavOnly, setShowFavOnly] = useState(false);

  const visitorId = getVisitorId();

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-event-by-token?token=${token}&visitor_id=${visitorId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro");
        setEvent(json.event);
        setPhotos(json.photos);
        setFavorites(new Set(json.favoriteIds));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, visitorId]);

  const toggleFav = useCallback(async (photoId: string) => {
    const wasFav = favorites.has(photoId);
    const next = new Set(favorites);
    wasFav ? next.delete(photoId) : next.add(photoId);
    setFavorites(next);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, photo_id: photoId, visitor_id: visitorId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // revert
      setFavorites(favorites);
      toast.error("Não foi possível favoritar");
    }
  }, [favorites, token, visitorId]);

  const download = async (photo: Photo) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-photo?token=${token}&photo_id=${photo.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.open(json.url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-medium">Galeria indisponível</h1>
      <p className="text-muted-foreground">{error === "Link expired" ? "Este link expirou." : error === "Event inactive" ? "Esta galeria foi desativada." : error === "Not found" ? "Link inválido." : error}</p>
    </div>
  );
  if (!event) return null;

  const visible = showFavOnly ? photos.filter((p) => favorites.has(p.id)) : photos;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium">{event.name}</h1>
            {event.event_date && <p className="text-sm text-muted-foreground">{format(new Date(event.event_date), "dd 'de' MMMM 'de' yyyy")}</p>}
            {event.description && <p className="text-sm text-muted-foreground mt-1">{event.description}</p>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{photos.length} fotos · {favorites.size} favoritas</span>
            <Button variant={showFavOnly ? "default" : "outline"} size="sm" onClick={() => setShowFavOnly(!showFavOnly)} className="gap-2">
              <Heart className={`w-4 h-4 ${showFavOnly ? "fill-current" : ""}`} /> Favoritas
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {visible.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhuma foto.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {visible.map((p, i) => (
              <div key={p.id} className="relative group aspect-square overflow-hidden bg-muted cursor-pointer" onClick={() => setLightboxIdx(photos.indexOf(p))}>
                <img src={p.url} alt={p.filename} className="w-full h-full object-cover" loading="lazy" />
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFav(p.id); }}
                  className="absolute top-2 right-2 bg-background/80 backdrop-blur p-1.5 rounded-full"
                  aria-label="Favoritar"
                >
                  <Heart className={`w-4 h-4 ${favorites.has(p.id) ? "fill-destructive text-destructive" : ""}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {lightboxIdx !== null && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col" onClick={() => setLightboxIdx(null)}>
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-muted-foreground">
              {lightboxIdx + 1} / {photos.length}
              {photos[lightboxIdx].taken_at && <span className="ml-3">{format(new Date(photos[lightboxIdx].taken_at!), "dd/MM/yyyy HH:mm")}</span>}
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => toggleFav(photos[lightboxIdx].id)} className="gap-2">
                <Heart className={`w-4 h-4 ${favorites.has(photos[lightboxIdx].id) ? "fill-destructive text-destructive" : ""}`} />
              </Button>
              {event.allow_download && (
                <Button variant="ghost" size="sm" onClick={() => download(photos[lightboxIdx])} className="gap-2">
                  <Download className="w-4 h-4" /> Baixar
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setLightboxIdx(null)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img src={photos[lightboxIdx].url} alt="" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex justify-between p-4">
            <Button variant="outline" disabled={lightboxIdx === 0} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}>Anterior</Button>
            <Button variant="outline" disabled={lightboxIdx === photos.length - 1} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientGallery;

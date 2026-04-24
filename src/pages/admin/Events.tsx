import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, Calendar as CalendarIcon, Trash2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Event {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  access_token: string;
  expires_at: string;
  is_active: boolean;
  allow_download: boolean;
  download_resolution: string;
  view_count: number;
  created_at: string;
}

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", event_date: "", expires_in_days: "15" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setEvents((data as Event[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const expires = new Date();
    expires.setDate(expires.getDate() + parseInt(form.expires_in_days));
    const { error } = await supabase.from("events").insert({
      owner_id: user.id,
      name: form.name,
      description: form.description || null,
      event_date: form.event_date || null,
      expires_at: expires.toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Evento criado");
    setCreateOpen(false);
    setForm({ name: "", description: "", event_date: "", expires_in_days: "15" });
    load();
  };

  const toggleActive = async (ev: Event) => {
    const { error } = await supabase.from("events").update({ is_active: !ev.is_active }).eq("id", ev.id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleDownload = async (ev: Event) => {
    const { error } = await supabase.from("events").update({ allow_download: !ev.allow_download }).eq("id", ev.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (ev: Event) => {
    if (!confirm(`Excluir "${ev.name}" e todas suas fotos?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) return toast.error(error.message);
    toast.success("Evento excluído");
    load();
  };

  const copyLink = (ev: Event) => {
    const url = `${window.location.origin}/e/${ev.access_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const isExpired = (ev: Event) => new Date(ev.expires_at) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-medium bg-gradient-primary bg-clip-text text-transparent">Eventos</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie galerias para seus clientes</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-primary hover:opacity-90 transition-opacity"><Plus className="w-4 h-4" /> Novo evento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Casamento João e Maria" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data do evento</Label>
                  <Input id="date" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp">Link expira em</Label>
                  <Select value={form.expires_in_days} onValueChange={(v) => setForm({ ...form, expires_in_days: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : events.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhum evento ainda. Clique em "Novo evento" para começar.
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((ev) => (
            <Card key={ev.id} className="p-5 border-l-4 border-l-primary hover:shadow-lg hover:shadow-primary/10 transition-all">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/admin/events/${ev.id}`} className="text-lg font-medium hover:text-primary transition-colors">{ev.name}</Link>
                    {ev.is_active && !isExpired(ev) && <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">Ativo</span>}
                    {!ev.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Inativo</span>}
                    {isExpired(ev) && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">Expirado</span>}
                  </div>
                  {ev.description && <p className="text-sm text-muted-foreground mt-1">{ev.description}</p>}
                  <div className="flex gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                    {ev.event_date && <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3 text-info" /> {format(new Date(ev.event_date), "dd/MM/yyyy")}</span>}
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-accent" /> {ev.view_count} views</span>
                    <span className="flex items-center gap-1 text-warning">Expira em {format(new Date(ev.expires_at), "dd/MM/yyyy")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => copyLink(ev)} className="gap-2 hover:bg-info/10 hover:text-info hover:border-info"><Copy className="w-3 h-3" /> Link</Button>
                  <a href={`/e/${ev.access_token}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-2 hover:bg-accent/10 hover:text-accent hover:border-accent"><ExternalLink className="w-3 h-3" /> Abrir</Button>
                  </a>
                  <Link to={`/admin/events/${ev.id}`}>
                    <Button size="sm" className="bg-gradient-primary hover:opacity-90">Gerenciar fotos</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => remove(ev)} className="hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="border-t border-border mt-4 pt-4 flex flex-wrap gap-6 items-center text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={ev.is_active} onCheckedChange={() => toggleActive(ev)} />
                  <span>Ativo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={ev.allow_download} onCheckedChange={() => toggleDownload(ev)} />
                  <span>Permitir download</span>
                </label>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Events;

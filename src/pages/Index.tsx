import { Link } from "react-router-dom";
import { Camera, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
      <Camera className="w-12 h-12 mb-6" />
      <h1 className="text-3xl md:text-4xl font-medium mb-3">Photo Delivery</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Sistema privado de entrega de fotos para clientes.
        Cada evento tem um link único e temporário.
      </p>
      <Link to="/admin/login">
        <Button className="gap-2"><Lock className="w-4 h-4" /> Acesso do fotógrafo</Button>
      </Link>
      <p className="text-xs text-muted-foreground mt-8 max-w-sm">
        Cliente? Use o link privado que você recebeu por email ou mensagem.
      </p>
    </div>
  );
};

export default Index;

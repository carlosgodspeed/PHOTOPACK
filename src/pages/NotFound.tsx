import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
    <h1 className="text-6xl font-light">404</h1>
    <p className="text-muted-foreground">Página não encontrada</p>
    <Link to="/"><Button variant="outline">Voltar</Button></Link>
  </div>
);

export default NotFound;

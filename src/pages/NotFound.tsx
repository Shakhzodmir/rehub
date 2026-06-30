import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function NotFound() {
  const { user } = useAuth();
  const home = user ? `/${user.role}` : "/login";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background p-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="h-8 w-8" />
      </span>
      <div>
        <p className="font-heading text-5xl font-bold text-primary">404</p>
        <h1 className="mt-2 font-heading text-xl font-bold">Страница не найдена</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Похоже, такой страницы нет или ссылка устарела.
        </p>
      </div>
      <Button asChild>
        <Link to={home}>
          <Home className="h-4 w-4" /> На главную
        </Link>
      </Button>
    </div>
  );
}

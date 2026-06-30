import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

const CHUNK_ERROR = /Loading chunk|dynamically imported module|Failed to fetch dynamically/i;

/** Catches render errors so one broken page can't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Необработанная ошибка интерфейса:", error, info);
    // a stale chunk after a deploy → a full reload pulls the new bundle
    if (CHUNK_ERROR.test(error.message)) window.location.reload();
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </span>
          <div>
            <h1 className="font-heading text-xl font-bold">Что-то пошло не так</h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу — ваши данные
              сохранены локально.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" /> Перезагрузить
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

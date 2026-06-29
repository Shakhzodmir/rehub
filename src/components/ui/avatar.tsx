import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
}

export function Avatar({ name, src, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary",
        className
      )}
      aria-label={name}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

interface ChatThreadProps {
  title: string;
  subtitle?: string;
  initial: Message[];
  /** sender label used for locally-sent messages */
  selfName: string;
}

export function ChatThread({ title, subtitle, initial, selfName }: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // reset when switching threads
  useEffect(() => setMessages(initial), [initial]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setMessages((m) => [
      ...m,
      {
        id: `local-${Date.now()}`,
        threadId: initial[0]?.threadId ?? "t",
        fromId: "self",
        fromName: selfName,
        text: value,
        at: new Date().toISOString(),
        mine: true,
      },
    ]);
    setText("");
  };

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Avatar name={title} />
        <div>
          <div className="font-heading font-semibold leading-tight">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm",
                m.mine
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted text-foreground"
              )}
            >
              <p>{m.text}</p>
              <p className={cn("mt-1 text-[11px]", m.mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {formatRelative(m.at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите сообщение…"
          aria-label="Текст сообщения"
        />
        <Button type="submit" size="icon" aria-label="Отправить" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

import { useSyncExternalStore } from "react";

export type ToastVariant = "default" | "success" | "warning" | "destructive";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  // new array reference so useSyncExternalStore detects the change
  items = [...items];
  listeners.forEach((l) => l());
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  listeners.forEach((l) => l());
}

export function toast(input: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}) {
  const id = nextId++;
  const item: ToastItem = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
    duration: input.duration ?? 4000,
  };
  items = [...items, item];
  listeners.forEach((l) => l());
  if (item.duration > 0) {
    setTimeout(() => dismissToast(id), item.duration);
  }
  return id;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return items;
}

export function useToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import axios from "axios";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function handleApiError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    toast.error(err.response?.data?.detail || fallback);
  } else {
    toast.error("An unexpected error occurred");
  }
}
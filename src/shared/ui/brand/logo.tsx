import { cn } from "@/shared/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" fill="#2A9D8F" />
      <path d="M18 20 L32 46 L46 20" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="15" r="5" fill="#F4A261" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="text-xl font-bold text-text">
        Via<span className="text-primary">nda</span>
      </span>
    </span>
  );
}

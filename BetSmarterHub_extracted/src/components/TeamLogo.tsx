import { useState } from "react";
import { Shield } from "lucide-react";

interface TeamLogoProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function TeamLogo({ src, name, size = 24, className = "" }: TeamLogoProps) {
  const [errored, setErrored] = useState(false);
  const dim = { width: size, height: size };
  if (!src || errored) {
    return (
      <span
        aria-label={name}
        title={name}
        style={dim}
        className={`inline-flex items-center justify-center rounded bg-muted text-muted-foreground shrink-0 ${className}`}
      >
        <Shield style={{ width: size * 0.6, height: size * 0.6 }} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      title={name}
      style={dim}
      onError={() => setErrored(true)}
      className={`object-contain shrink-0 ${className}`}
      loading="lazy"
    />
  );
}

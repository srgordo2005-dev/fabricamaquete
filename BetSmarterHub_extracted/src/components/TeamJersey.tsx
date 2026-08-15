// Generates a stylized soccer "jersey" SVG based on the team name.
// Colors are deterministic from the team name so the same team always gets the same kit.

function hashString(s: string | null | undefined): number {
  const str = String(s ?? "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// A small curated palette of vivid jersey colors (primary + accent pairs).
const PALETTES: Array<[string, string]> = [
  ["#e11d48", "#ffffff"], // red / white
  ["#1d4ed8", "#ffffff"], // blue / white
  ["#000000", "#ffffff"], // black / white
  ["#16a34a", "#ffffff"], // green / white
  ["#facc15", "#000000"], // yellow / black
  ["#0ea5e9", "#1e293b"], // sky / navy
  ["#f97316", "#000000"], // orange / black
  ["#7c3aed", "#ffffff"], // purple / white
  ["#dc2626", "#1e3a8a"], // red / navy
  ["#0f766e", "#ffffff"], // teal / white
  ["#ffffff", "#dc2626"], // white / red
  ["#1e3a8a", "#facc15"], // navy / yellow
];

const PATTERNS = ["solid", "stripes", "halves", "hoops"] as const;
type Pattern = (typeof PATTERNS)[number];

export function getKit(name: string): { primary: string; accent: string; pattern: Pattern } {
  const h = hashString(name || "team");
  const [primary, accent] = PALETTES[h % PALETTES.length];
  const pattern = PATTERNS[(h >> 4) % PATTERNS.length];
  return { primary, accent, pattern };
}

interface Props {
  team: string;
  size?: number;
  className?: string;
}

export function TeamJersey({ team, size = 28, className }: Props) {
  const { primary, accent, pattern } = getKit(team);
  const id = `kit-${hashString(team)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-label={`Camisa ${team}`}
    >
      <defs>
        <clipPath id={id}>
          {/* Jersey silhouette: body + sleeves */}
          <path d="M20 8 L8 14 L4 26 L14 30 L14 56 Q14 60 18 60 L46 60 Q50 60 50 56 L50 30 L60 26 L56 14 L44 8 L40 12 Q32 18 24 12 Z" />
        </clipPath>
      </defs>

      {/* Base fill */}
      <rect x="0" y="0" width="64" height="64" fill={primary} clipPath={`url(#${id})`} />

      {/* Pattern */}
      {pattern === "stripes" && (
        <g clipPath={`url(#${id})`}>
          {[18, 28, 38, 48].map((x) => (
            <rect key={x} x={x} y="0" width="6" height="64" fill={accent} opacity="0.85" />
          ))}
        </g>
      )}
      {pattern === "halves" && (
        <rect x="32" y="0" width="32" height="64" fill={accent} clipPath={`url(#${id})`} opacity="0.9" />
      )}
      {pattern === "hoops" && (
        <g clipPath={`url(#${id})`}>
          {[20, 32, 44, 56].map((y) => (
            <rect key={y} x="0" y={y} width="64" height="5" fill={accent} opacity="0.9" />
          ))}
        </g>
      )}

      {/* Outline */}
      <path
        d="M20 8 L8 14 L4 26 L14 30 L14 56 Q14 60 18 60 L46 60 Q50 60 50 56 L50 30 L60 26 L56 14 L44 8 L40 12 Q32 18 24 12 Z"
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Collar */}
      <path d="M26 10 Q32 16 38 10" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" />
    </svg>
  );
}

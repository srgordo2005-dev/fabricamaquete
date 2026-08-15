// Dynamically generates a high-quality SVG vector illustration of a Mura Rooster based on its plumage.
function getRoosterSVG(plumage) {
  let primaryColor = "#d97706";   // default orange/brown
  let secondaryColor = "#78350f"; // default dark brown
  let tailColor = "#0f172a";      // dark grey/black tail
  let legColor = "#fbbf24";       // yellow legs by default
  let highlights = "none";
  let patternId = "";

  // Set colors and patterns based on the 10 plumage types from the photo
  switch (plumage) {
    case 'Caboclo':
      primaryColor = "#b91c1c";   // rich dark red neck
      secondaryColor = "#1e293b"; // dark body
      tailColor = "#0f172a";
      break;
    case 'Preto':
      primaryColor = "#111827";   // full black
      secondaryColor = "#030712";
      tailColor = "#111827";
      break;
    case 'Ruano':
      primaryColor = "#f59e0b";   // golden neck
      secondaryColor = "#f8fafc"; // white body
      tailColor = "#cbd5e1";      // light grey/silver tail
      break;
    case 'Coca':
      primaryColor = "#ea580c";   // red-orange neck
      secondaryColor = "#78350f"; // brown body
      tailColor = "#451a03";
      break;
    case 'Roxo':
      primaryColor = "#581c87";   // violet-purple neck/shoulders
      secondaryColor = "#1e1b4b"; // dark purple body
      tailColor = "#312e81";
      break;
    case 'Branco':
      primaryColor = "#f8fafc";   // full white
      secondaryColor = "#e2e8f0";
      tailColor = "#cbd5e1";
      legColor = "#f59e0b";
      break;
    case 'Capa Amarela':
      primaryColor = "#fbbf24";   // bright yellow cape/neck
      secondaryColor = "#0f172a"; // dark body
      tailColor = "#1e293b";
      break;
    case 'Prata':
      primaryColor = "#94a3b8";   // silver grey neck
      secondaryColor = "#334155"; // medium grey body
      tailColor = "#1e293b";
      break;
    case 'Carijó':
      primaryColor = "url(#carijoPattern)";
      secondaryColor = "#334155";
      patternId = "carijo";
      break;
    case 'Puva':
      primaryColor = "#d97706";   // orange-brown neck
      secondaryColor = "#475569"; // slate grey body
      tailColor = "#1e293b";
      break;
    default:
      primaryColor = "#d97706";
      secondaryColor = "#78350f";
  }

  let defs = "";
  if (patternId === "carijo") {
    defs = `
      <defs>
        <pattern id="carijoPattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#1e2937"/>
          <!-- Speckled dots and hatches for Carijó plumage -->
          <circle cx="4" cy="4" r="2" fill="#f3f4f6" />
          <circle cx="12" cy="12" r="2.5" fill="#f3f4f6" />
          <circle cx="12" cy="4" r="1.5" fill="#9ca3af" />
          <circle cx="4" cy="12" r="1.5" fill="#9ca3af" />
        </pattern>
      </defs>
    `;
  }

  // A sleek, athletic Mura rooster vector silhouette
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width="100%" height="100%">
      ${defs}
      
      <!-- Legs and Feet -->
      <path d="M75,150 L65,200 L55,205 M65,200 L75,205" stroke="${legColor}" stroke-width="5" stroke-linecap="round" fill="none" />
      <path d="M100,150 L105,200 L115,205 M105,200 L95,205" stroke="${legColor}" stroke-width="5" stroke-linecap="round" fill="none" />
      
      <!-- Tail Feathers -->
      <path d="M120,120 Q170,50 190,90 Q170,110 120,130" fill="${tailColor}" opacity="0.9" />
      <path d="M110,110 Q185,25 185,70 Q160,95 110,120" fill="${tailColor}" />
      <path d="M115,120 Q160,70 170,105 Q150,120 115,130" fill="${secondaryColor}" opacity="0.8" />

      <!-- Body -->
      <path d="M60,110 C45,110 50,160 85,160 C120,160 130,110 115,110 Z" fill="${secondaryColor}" />
      <path d="M55,105 C40,105 45,150 80,150 C115,150 125,105 110,105 Z" fill="${primaryColor}" />

      <!-- Neck & Breast -->
      <path d="M50,90 C40,95 45,130 65,140 C85,150 85,110 65,95 Z" fill="${primaryColor}" />
      <path d="M45,70 C50,85 55,105 50,125 C70,115 80,100 70,75 Z" fill="${primaryColor}" />

      <!-- Head -->
      <path d="M45,70 C48,55 60,52 65,65 C68,75 58,85 45,70 Z" fill="${primaryColor}" />
      
      <!-- Comb (Cresta) -->
      <path d="M58,54 C54,48 64,46 62,54 C66,48 70,54 65,58 Z" fill="#dc2626" />
      
      <!-- Wattles (Gola) -->
      <path d="M48,72 C46,78 52,78 50,72 Z" fill="#dc2626" />

      <!-- Beak -->
      <path d="M45,66 L37,68 L44,71 Z" fill="#f59e0b" />

      <!-- Eye -->
      <circle cx="53" cy="64" r="2.5" fill="#f59e0b" />
      <circle cx="53.5" cy="63.5" r="1" fill="#000000" />
      
      <!-- Wing -->
      <path d="M65,115 C55,115 65,145 90,140 C110,135 115,120 100,115 Z" fill="${secondaryColor}" />
      <path d="M68,118 C60,118 70,138 88,135 C102,132 108,122 95,118 Z" fill="${primaryColor}" stroke="${secondaryColor}" stroke-width="1" />
    </svg>
  `;
}

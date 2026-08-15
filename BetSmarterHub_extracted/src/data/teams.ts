// Mock catálogo de times — depois pluga API/DB
export interface TeamTheme {
  id: string;
  name: string;
  shortName: string;
  league: string;
  country: string;
  // OKLCH para combinar com o design system
  primary: string;        // ex: "0.55 0.22 25"
  accent: string;
  logo: string;           // emoji/símbolo (fallback)
  flag: string;
  badge?: string;         // URL do escudo oficial
}

const AF = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

export const TEAMS: TeamTheme[] = [
  { id: "flamengo",  name: "Flamengo",      shortName: "FLA", league: "Brasileirão",  country: "BR", primary: "0.55 0.22 25",  accent: "0.85 0.18 90",  logo: "🔴", flag: "🇧🇷", badge: AF(127) },
  { id: "palmeiras", name: "Palmeiras",     shortName: "PAL", league: "Brasileirão",  country: "BR", primary: "0.55 0.18 150", accent: "0.95 0.02 150", logo: "🟢", flag: "🇧🇷", badge: AF(121) },
  { id: "corinthians", name: "Corinthians", shortName: "COR", league: "Brasileirão",  country: "BR", primary: "0.25 0.02 260", accent: "0.95 0.02 260", logo: "⚫", flag: "🇧🇷", badge: AF(131) },
  { id: "saopaulo",  name: "São Paulo",     shortName: "SAO", league: "Brasileirão",  country: "BR", primary: "0.55 0.22 25",  accent: "0.25 0.10 260", logo: "🔴", flag: "🇧🇷", badge: AF(126) },
  { id: "vasco",     name: "Vasco",         shortName: "VAS", league: "Brasileirão",  country: "BR", primary: "0.20 0.02 260", accent: "0.95 0.02 260", logo: "⚫", flag: "🇧🇷", badge: AF(133) },
  { id: "fluminense", name: "Fluminense",   shortName: "FLU", league: "Brasileirão",  country: "BR", primary: "0.45 0.18 155", accent: "0.55 0.22 25",  logo: "🟢", flag: "🇧🇷", badge: AF(124) },
  { id: "botafogo",  name: "Botafogo",      shortName: "BOT", league: "Brasileirão",  country: "BR", primary: "0.20 0.02 260", accent: "0.99 0 0",      logo: "⭐", flag: "🇧🇷", badge: AF(120) },
  { id: "gremio",    name: "Grêmio",        shortName: "GRE", league: "Brasileirão",  country: "BR", primary: "0.45 0.18 240", accent: "0.55 0.22 25",  logo: "🔵", flag: "🇧🇷", badge: AF(130) },
  { id: "internacional", name: "Internacional", shortName: "INT", league: "Brasileirão", country: "BR", primary: "0.55 0.22 25", accent: "0.99 0 0",   logo: "🔴", flag: "🇧🇷", badge: AF(119) },
  { id: "atleticomg", name: "Atlético-MG",  shortName: "CAM", league: "Brasileirão",  country: "BR", primary: "0.25 0.02 260", accent: "0.85 0.15 80",  logo: "🦅", flag: "🇧🇷", badge: AF(1062) },
  { id: "realmadrid", name: "Real Madrid",  shortName: "RMA", league: "La Liga",      country: "ES", primary: "0.99 0 0",      accent: "0.85 0.18 90",  logo: "👑", flag: "🇪🇸", badge: AF(541) },
  { id: "barcelona", name: "Barcelona",     shortName: "BAR", league: "La Liga",      country: "ES", primary: "0.45 0.18 240", accent: "0.55 0.22 25",  logo: "🔵", flag: "🇪🇸", badge: AF(529) },
  { id: "atletico",  name: "Atlético Madrid", shortName: "ATM", league: "La Liga",    country: "ES", primary: "0.55 0.22 25",  accent: "0.99 0 0",      logo: "🔴", flag: "🇪🇸", badge: AF(530) },
  { id: "manchestercity", name: "Manchester City", shortName: "MCI", league: "Premier League", country: "EN", primary: "0.75 0.12 220", accent: "0.99 0 0", logo: "🌌", flag: "🇬🇧", badge: AF(50) },
  { id: "manchesterunited", name: "Manchester United", shortName: "MUN", league: "Premier League", country: "EN", primary: "0.55 0.22 25", accent: "0.85 0.18 90", logo: "👹", flag: "🇬🇧", badge: AF(33) },
  { id: "liverpool", name: "Liverpool",     shortName: "LIV", league: "Premier League", country: "EN", primary: "0.50 0.22 25",  accent: "0.85 0.18 90",  logo: "🔴", flag: "🇬🇧", badge: AF(40) },
  { id: "chelsea",   name: "Chelsea",       shortName: "CHE", league: "Premier League", country: "EN", primary: "0.40 0.18 245", accent: "0.99 0 0",     logo: "🦁", flag: "🇬🇧", badge: AF(49) },
  { id: "arsenal",   name: "Arsenal",       shortName: "ARS", league: "Premier League", country: "EN", primary: "0.55 0.22 25",  accent: "0.99 0 0",     logo: "🔴", flag: "🇬🇧", badge: AF(42) },
  { id: "psg",       name: "PSG",           shortName: "PSG", league: "Ligue 1",      country: "FR", primary: "0.30 0.10 260", accent: "0.55 0.22 25",  logo: "🗼", flag: "🇫🇷", badge: AF(85) },
  { id: "bayern",    name: "Bayern Munich", shortName: "BAY", league: "Bundesliga",   country: "DE", primary: "0.55 0.22 25",  accent: "0.45 0.18 240", logo: "🔴", flag: "🇩🇪", badge: AF(157) },
  { id: "juventus",  name: "Juventus",      shortName: "JUV", league: "Serie A",      country: "IT", primary: "0.20 0.02 260", accent: "0.99 0 0",      logo: "⚫", flag: "🇮🇹", badge: AF(496) },
  { id: "milan",     name: "Milan",         shortName: "MIL", league: "Serie A",      country: "IT", primary: "0.50 0.22 25",  accent: "0.20 0.02 260", logo: "🔴", flag: "🇮🇹", badge: AF(489) },
  { id: "inter",     name: "Inter Milan",   shortName: "INT", league: "Serie A",      country: "IT", primary: "0.40 0.18 245", accent: "0.20 0.02 260", logo: "🐍", flag: "🇮🇹", badge: AF(505) },
];

export const LEAGUES = Array.from(new Set(TEAMS.map(t => t.league)));
export const getTeam = (id: string | null | undefined) => TEAMS.find(t => t.id === id);

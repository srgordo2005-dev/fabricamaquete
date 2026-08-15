// Compatibility shim — XP/badges agora vivem em user_profiles (Supabase).
// Mantém a mesma interface do hook antigo para não quebrar imports.
export { useProfile as useXP, BADGES } from "@/hooks/useProfile";

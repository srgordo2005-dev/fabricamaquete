import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { useProfile, BADGES } from "@/hooks/useProfile";
import { TeamPicker } from "@/components/TeamPicker";
import { Switch } from "@/components/ui/switch";
import { isFanaticEnabled, setFanaticEnabled } from "@/components/FanaticTheme";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { team } = useFavoriteTeam();
  const { profile, xp, level, nextLevelXp, badges, updateProfile, refresh } = useProfile();
  
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [uploading, setUploading] = useState(false);


  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
    }
  }, [profile]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="card-elev p-8 text-center">
          <p className="mb-4">{t("profile.loginRequired")}</p>
          <Link to="/auth"><Button>{t("nav.login")}</Button></Link>
        </Card>
      </div>
    );
  }

  const totalForLevel = xp + nextLevelXp;
  const pct = totalForLevel > 0 ? ((totalForLevel - nextLevelXp) / totalForLevel) * 100 : 0;

  const save = async () => {
    const { error } = await updateProfile({ display_name: displayName.trim() || null, username: username.trim() || null });
    if (error) toast.error(error);
    else { toast.success(t("profile.updated")); setEditing(false); }
  };

  const onAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await updateProfile({ avatar_url: data.publicUrl });
    setUploading(false);
    toast.success(t("profile.avatarUpdated"));
    refresh();
  };


  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors />
      <TeamPicker open={pickerOpen} onOpenChange={setPickerOpen} />
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold mb-6">{t("profile.title")}</h1>

        <Card className="card-elev p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-20 h-20 rounded-full bg-primary/20 ring-2 ring-primary/40 grid place-items-center overflow-hidden text-3xl font-bold">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : (profile?.display_name?.[0] || "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-[200px]">
              {editing ? (
                <div className="space-y-2">
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t("profile.displayName")} maxLength={50} />
                  <Input value={username} onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())} placeholder={t("profile.username")} maxLength={20} />
                </div>
              ) : (
                <>
                  <p className="font-bold text-xl">{profile?.display_name || "—"}</p>
                  <p className="text-sm text-muted-foreground">@{profile?.username || t("profile.noUsername")}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={save}>{t("common.save")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{t("common.edit")}</Button>
              )}
              <label className="text-xs underline cursor-pointer text-muted-foreground hover:text-primary">
                {uploading ? t("profile.sending") : t("profile.changeAvatar")}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={e => e.target.files?.[0] && onAvatar(e.target.files[0])} />
              </label>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card className="card-elev p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{team?.logo || "⚽"}</span>
              <div>
                <p className="text-sm text-muted-foreground">{t("profile.favoriteTeam")}</p>
                <p className="font-bold text-lg">{team?.name || t("profile.notChosen")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>{t("profile.changeTeam")}</Button>
              {team && <FanaticToggle />}
            </div>
          </Card>

        </div>

        <Card className="card-elev p-6 mb-6">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-sm text-muted-foreground">{t("profile.level")}</p>
              <p className="text-3xl font-bold">{level}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t("profile.xpTotal")}: {xp}</p>
              <p className="text-xs">{nextLevelXp} {t("profile.xpToNext")}</p>
            </div>
          </div>
          <Progress value={pct} />
        </Card>

        <Card className="card-elev p-6">
          <h2 className="font-bold mb-4">{t("profile.badges")} ({badges.length}/{BADGES.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BADGES.map(b => {
              const unlocked = badges.includes(b.id);
              return (
                <div key={b.id}
                  title={unlocked ? b.desc : `🔒 ${b.desc}`}
                  className={`p-3 rounded-lg border transition-all ${unlocked
                    ? "border-primary/40 bg-primary/5 glow"
                    : "border-border/40 opacity-50 grayscale"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{b.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </main>
      <ResponsibleFooter />

    </div>
  );
}

function FanaticToggle() {
  const [on, setOn] = useState(isFanaticEnabled());
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <span className="text-muted-foreground">Modo Fanático</span>
      <Switch
        checked={on}
        onCheckedChange={(v) => { setFanaticEnabled(v); setOn(v); }}
      />
    </label>
  );
}

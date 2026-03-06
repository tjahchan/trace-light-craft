import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://trace-light-craft.lovable.app";

interface UserStreak {
  user_id: string;
  current_streak: number;
  best_streak: number;
  last_note_date: string | null;
}

interface NotifPref {
  user_id: string;
  streak_reminders: boolean;
  weekly_encouragement: boolean;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function buildEmail(
  type: "missed1" | "missed2" | "missed5" | "weekly",
  name: string,
  streak: number
): { subject: string; html: string } {
  const cta = `<a href="${APP_URL}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:16px;">Open Momentra</a>`;

  const wrapper = (body: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f0a;font-family:Inter,sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:40px 24px;">
<div style="text-align:center;margin-bottom:24px;">
<span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:0.1em;">Momentra</span>
</div>
<div style="background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;color:#e5e5e5;font-size:14px;line-height:1.6;">
${body}
<div style="text-align:center;margin-top:24px;">${cta}</div>
</div>
<p style="text-align:center;color:#555;font-size:11px;margin-top:24px;">
You're receiving this because you have streak reminders enabled in Momentra settings.
</p>
</div></body></html>`;

  switch (type) {
    case "missed1":
      return {
        subject: `🔥 Don't break your streak, ${name}!`,
        html: wrapper(`
<h2 style="color:#fff;margin:0 0 12px;">Your streak is at risk!</h2>
<p>You missed yesterday. Your <strong style="color:#3b82f6;">${streak}-day streak</strong> is on the line.</p>
<p>Log in and write a note today to keep it alive.</p>`),
      };
    case "missed2":
      return {
        subject: `⚠️ Your streak has reset — but you can start fresh`,
        html: wrapper(`
<h2 style="color:#fff;margin:0 0 12px;">Your streak has reset to 0</h2>
<p>The best traders journal every day. Come back and start a new streak today.</p>
<p>Your best streak record of <strong style="color:#3b82f6;">${streak} days</strong> is still saved — beat it!</p>`),
      };
    case "missed5":
      return {
        subject: `We miss you on Momentra 📉`,
        html: wrapper(`
<h2 style="color:#fff;margin:0 0 12px;">It's been 5 days, ${name}</h2>
<p>Your trades are waiting to be reviewed. Every day without journaling is a missed learning opportunity.</p>
<p>Come back, review your trades, and get back on track.</p>`),
      };
    case "weekly":
      return {
        subject: `🔥 ${streak}-day streak — keep going!`,
        html: wrapper(`
<h2 style="color:#fff;margin:0 0 12px;">Weekly Streak Report</h2>
<p>Amazing work, ${name}! You're on a <strong style="color:#22c55e;">${streak}-day streak</strong>.</p>
<p>Keep the momentum going — consistency separates good traders from great ones.</p>`),
      };
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY not set");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Momentra <noreply@momentra.app>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error("Email send failed:", await res.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const isSunday = today.getDay() === 0;

    // Get all streaks with profiles and notification prefs
    const { data: streaks } = await supabase
      .from("user_streaks")
      .select("*");

    if (!streaks || streaks.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = streaks.map((s: UserStreak) => s.user_id);

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .in("user_id", userIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", userIds);

    const prefsMap = new Map<string, NotifPref>();
    prefs?.forEach((p: NotifPref) => prefsMap.set(p.user_id, p));

    const profilesMap = new Map<string, Profile>();
    profiles?.forEach((p: Profile) => profilesMap.set(p.user_id, p));

    let sent = 0;

    for (const streak of streaks as UserStreak[]) {
      const pref = prefsMap.get(streak.user_id);
      const profile = profilesMap.get(streak.user_id);
      if (!profile?.email) continue;

      const name = profile.display_name || "Trader";
      const missed = daysSince(streak.last_note_date);

      // Streak reminders
      if (pref?.streak_reminders !== false) {
        if (missed === 1) {
          const { subject, html } = buildEmail("missed1", name, streak.current_streak);
          await sendEmail(profile.email, subject, html);
          sent++;
        } else if (missed === 2) {
          const { subject, html } = buildEmail("missed2", name, streak.best_streak);
          await sendEmail(profile.email, subject, html);
          sent++;
        } else if (missed === 5) {
          const { subject, html } = buildEmail("missed5", name, streak.best_streak);
          await sendEmail(profile.email, subject, html);
          sent++;
        }
      }

      // Weekly encouragement (Sunday, streak >= 3)
      if (isSunday && pref?.weekly_encouragement !== false && streak.current_streak >= 3 && missed <= 1) {
        const { subject, html } = buildEmail("weekly", name, streak.current_streak);
        await sendEmail(profile.email, subject, html);
        sent++;
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

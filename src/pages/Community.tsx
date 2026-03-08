import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  RefreshCw,
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Send,
  ArrowLeft,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Flame,
  DollarSign,
  Copy,
  Users,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

// ── Types ──
type LeaderboardTab = "streak" | "pnl";

interface LeaderboardEntry {
  rank: number;
  display_name: string;
  email: string;
  current_streak?: number;
  best_streak?: number;
  total_pnl?: number;
}

interface CommunityPost {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  likes: number;
  parent_id: string | null;
  replies?: CommunityPost[];
}

// ── Helpers ──
function obfuscateEmail(email: string | null, displayName: string | null) {
  if (displayName) return displayName;
  if (!email) return "Anonymous";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function crownColor(rank: number) {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-gray-300";
  if (rank === 3) return "text-amber-600";
  return "";
}

// ── Main Component ──
export default function Community() {
  const { user } = useAuth();

  // Chat state
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Leaderboard state (secondary)
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("streak");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbPage, setLbPage] = useState(0);
  const [lbLoading, setLbLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ── Fetch chat posts ──
  const fetchPosts = async () => {
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const ids = data.map((p) => p.id);
      const { data: replies } = await supabase
        .from("community_posts")
        .select("*")
        .in("parent_id", ids)
        .order("created_at", { ascending: true });

      const postsWithReplies: CommunityPost[] = data.map((p) => ({
        ...p,
        replies: (replies || []).filter((r) => r.parent_id === p.id),
      }));
      setPosts(postsWithReplies);
    }
  };

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel("community_posts_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Send message ──
  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", user.id)
      .single();
    const username = profile?.display_name || profile?.email?.split("@")[0] || "Trader";
    await supabase.from("community_posts").insert({
      user_id: user.id,
      username,
      content: newMessage.trim(),
      parent_id: replyTo,
    });
    setNewMessage("");
    setReplyTo(null);
    setSending(false);
  };

  const handleLike = async (postId: string) => {
    await supabase.rpc("like_post", { post_id: postId });
  };

  const toggleReplies = (postId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  // ── Fetch leaderboard ──
  const fetchLeaderboard = async (page = 0) => {
    setLbLoading(true);
    try {
      if (activeTab === "streak") {
        const { data, error } = await supabase.rpc("get_streak_leaderboard", {
          p_limit: 10,
          p_offset: page * 10,
        });
        if (!error && data) {
          const entries = (data as any[]).map((d) => ({
            rank: Number(d.rank),
            display_name: d.display_name,
            email: d.email,
            current_streak: d.current_streak,
            best_streak: d.best_streak,
          }));
          setLeaderboard(entries);
          setHasMore(entries.length === 10);
        } else {
          setLeaderboard([]);
          setHasMore(false);
        }
      } else {
        setLeaderboard([]);
        setHasMore(false);
      }
    } catch {
      setLeaderboard([]);
    }
    setLbLoading(false);
  };

  useEffect(() => {
    if (showLeaderboard) {
      setLbPage(0);
      fetchLeaderboard(0);
    }
  }, [activeTab, showLeaderboard]);

  const handlePageChange = (dir: number) => {
    const next = lbPage + dir;
    if (next < 0) return;
    setLbPage(next);
    fetchLeaderboard(next);
  };

  return (
    <div className="flex gap-6 flex-col xl:flex-row">
      {/* ── Main Column: Community Chat ── */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 min-w-0 space-y-4"
      >
        {/* Chat Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Community Chat
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share trade ideas, setups, reflections and discuss markets with other traders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild className="gap-1.5 bg-white/[0.04] border-white/[0.08] text-foreground">
              <a href="https://t.me/momentra" target="_blank" rel="noopener noreferrer">
                Join Telegram <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>

        {/* Live Chat */}
        <div
          className="backdrop-blur-xl bg-card/60 border border-border rounded-2xl overflow-hidden flex flex-col"
          style={{ minHeight: 400, maxHeight: 600 }}
        >
          {/* Chat header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Live Discussion</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{posts.length} messages</span>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
            <div className="space-y-3">
              {posts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No messages yet. Be the first to share a thought!
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="space-y-1.5">
                    <div className="rounded-xl bg-secondary/50 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{post.username}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80">{post.content}</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleLike(post.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ThumbsUp className="h-3 w-3" /> {post.likes}
                        </button>
                        <button
                          onClick={() => setReplyTo(replyTo === post.id ? null : post.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            replyTo === post.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <MessageSquare className="h-3 w-3" /> Reply
                        </button>
                        {post.replies && post.replies.length > 0 && (
                          <button
                            onClick={() => toggleReplies(post.id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {expandedReplies.has(post.id)
                              ? "Hide"
                              : `${post.replies.length} repl${post.replies.length === 1 ? "y" : "ies"}`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Replies */}
                    {expandedReplies.has(post.id) &&
                      post.replies?.map((reply) => (
                        <div key={reply.id} className="ml-6 rounded-xl bg-secondary/30 p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">{reply.username}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80">{reply.content}</p>
                          <button
                            onClick={() => handleLike(reply.id)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ThumbsUp className="h-2.5 w-2.5" /> {reply.likes}
                          </button>
                        </div>
                      ))}

                    {/* Reply input */}
                    {replyTo === post.id && (
                      <div className="ml-6 flex gap-2">
                        <Input
                          placeholder="Write a reply…"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSend()}
                          className="h-8 text-xs bg-secondary/30"
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          disabled={sending || !newMessage.trim()}
                          onClick={handleSend}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Bottom input */}
          {!replyTo && (
            <div className="flex gap-2 px-4 py-3 border-t border-border">
              <Input
                placeholder={user ? "Share a thought…" : "Log in to chat"}
                disabled={!user}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="h-9 text-sm bg-secondary/30"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={sending || !newMessage.trim() || !user}
                onClick={handleSend}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Right Column ── */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full xl:w-80 shrink-0 space-y-4"
      >
        {/* Invite Friends */}
        <ReferralCard />

        {/* Discipline Streaks - Collapsible Leaderboard */}
        <div className="backdrop-blur-xl bg-card/60 border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Top Discipline Streaks</p>
                <p className="text-[10px] text-muted-foreground">See who's most consistent</p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showLeaderboard ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {showLeaderboard && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {/* Tab Switcher */}
                <div className="px-5 pb-3">
                  <div className="flex rounded-full bg-secondary p-0.5 text-xs">
                    <button
                      onClick={() => setActiveTab("streak")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-all flex-1 justify-center ${
                        activeTab === "streak"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Flame className="h-3 w-3" /> Streak
                    </button>
                    <button
                      onClick={() => setActiveTab("pnl")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-all flex-1 justify-center ${
                        activeTab === "pnl"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <DollarSign className="h-3 w-3" /> PnL
                    </button>
                  </div>
                </div>

                {/* Table */}
                {lbLoading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
                ) : leaderboard.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    {activeTab === "pnl"
                      ? "PnL rankings coming soon."
                      : "No active streaks yet. Start journaling!"}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {leaderboard.map((item) => (
                        <tr key={item.rank + item.email} className="border-t border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="p-3 w-12">
                            <div className="flex items-center gap-1">
                              {item.rank <= 3 && <Crown className={`h-3 w-3 ${crownColor(item.rank)}`} />}
                              <span className="font-mono text-foreground text-xs">{lbPage * 10 + item.rank}</span>
                            </div>
                          </td>
                          <td className="p-3 text-foreground font-mono text-xs">
                            {obfuscateEmail(item.email, item.display_name)}
                          </td>
                          <td className="p-3 text-right font-mono text-foreground text-xs">
                            {activeTab === "streak" ? `${item.current_streak} days` : (
                              <span className={(item.total_pnl ?? 0) >= 0 ? "text-profit" : "text-loss"}>
                                {(item.total_pnl ?? 0) >= 0 ? "+" : ""}${(item.total_pnl ?? 0).toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Pagination */}
                {leaderboard.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
                    <Button variant="ghost" size="sm" disabled={lbPage === 0} onClick={() => handlePageChange(-1)} className="text-xs gap-1">
                      <ChevronLeft className="h-3 w-3" /> Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">Page {lbPage + 1}</span>
                    <Button variant="ghost" size="sm" disabled={!hasMore} onClick={() => handlePageChange(1)} className="text-xs gap-1">
                      Next <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ── Referral Card ──
function ReferralCard() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username, referral_code, referral_count")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setReferralCode(d.referral_code || d.username || user.id.slice(0, 8));
          setReferralCount(d.referral_count || 0);
        }
      });
  }, [user]);

  const referralLink = `momentra.app/ref/${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${referralLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="backdrop-blur-xl bg-card/60 border border-border rounded-2xl p-6 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Invite Friends</p>
          <p className="text-[10px] text-muted-foreground">{referralCount} friend{referralCount !== 1 ? "s" : ""} invited</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Share your link and grow the Momentra community.
      </p>
      <div className="flex gap-2">
        <Input
          value={referralLink}
          readOnly
          className="text-xs bg-white/[0.04] border-white/[0.08] text-foreground font-mono flex-1"
        />
        <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 shrink-0 bg-white/[0.04] border-white/[0.08] text-foreground">
          <Copy className="h-3 w-3" />
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

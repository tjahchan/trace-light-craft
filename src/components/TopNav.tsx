import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Settings, LogOut, BookOpen, Zap, Wrench, Target, Image, MessageSquare, Shield, Menu, X, CreditCard, HelpCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useNavigate } from "react-router-dom";
import { usePlan } from "@/contexts/PlanContext";
import { useBackground } from "@/contexts/BackgroundContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { title: "Dashboard", url: "/" },
  { title: "Overview", url: "/overview" },
  { title: "Journal", url: "/journal" },
  { title: "Leaderboard", url: "/community" },
];

interface TopNavProps {
  onFocusClick?: () => void;
  onBackgroundsClick?: () => void;
  onFeedbackClick?: () => void;
}

export function TopNav({ onFocusClick, onBackgroundsClick, onFeedbackClick }: TopNavProps) {
  const { user, signOut } = useAuth();
  const { startTour } = useOnboarding();
  const { isPro, triggerUpgrade, isAdmin } = usePlan();
  const { calendarOpacity, setCalendarOpacity } = useBackground();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "TR";

  const avatarUrl = user?.user_metadata?.avatar_url;

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await signOut();
    navigate("/auth");
  };

  const handleMobileNav = (url: string) => {
    setMobileMenuOpen(false);
    navigate(url);
  };

  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 sm:px-6 backdrop-blur-xl bg-black/40 border-b border-white/[0.08] shrink-0 z-50 sticky top-0">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
          <span className="text-foreground text-lg tracking-[0.08em] font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Momentra
          </span>
        </div>

        {/* Center Nav — Desktop only */}
        {!isMobile && (
          <nav className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {navItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end={item.url === "/"}
                className="relative px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-white/[0.05]"
                activeClassName="!text-foreground !bg-white/[0.08] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:bg-primary after:rounded-full"
              >
                {item.title}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {!isPro && !isMobile && (
            <button
              onClick={() => triggerUpgrade("Unlock broker auto sync, unlimited AI insights, and unlimited trade imports.")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-all hover:shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]"
            >
              <Zap className="h-3 w-3" /> Upgrade
            </button>
          )}

          {/* Tools Dropdown — Desktop */}
          {!isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors outline-none">
                  <Wrench className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-white/[0.08] w-64">
                <DropdownMenuItem className="text-foreground gap-2" onClick={() => onBackgroundsClick?.()}>
                  <Image className="h-3.5 w-3.5" /> Backgrounds
                </DropdownMenuItem>
                <DropdownMenuItem className="text-foreground gap-2" onClick={() => onFocusClick?.()}>
                  <Target className="h-3.5 w-3.5" /> Focus Timer
                </DropdownMenuItem>
                <DropdownMenuItem className="text-foreground gap-2" onClick={() => onFeedbackClick?.()}>
                  <MessageSquare className="h-3.5 w-3.5" /> Feedback
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <div className="px-3 py-2.5">
                  <p className="text-xs text-muted-foreground mb-2">Calendar Transparency</p>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[calendarOpacity]}
                      onValueChange={([v]) => setCalendarOpacity(v)}
                      min={20}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground font-mono w-8 text-right">{calendarOpacity}%</span>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={startTour}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
                >
                  <BookOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Take the Tour</TooltipContent>
            </Tooltip>
          )}

          {!isMobile && isAdmin && (
            <NavLink
              to="/admin"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
              activeClassName="!text-foreground !bg-white/[0.08]"
            >
              <Shield className="h-4 w-4" />
            </NavLink>
          )}

          {!isMobile && (
            <NavLink
              to="/settings"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
              activeClassName="!text-foreground !bg-white/[0.08]"
            >
              <Settings className="h-4 w-4" />
            </NavLink>
          )}

          {/* Avatar — always visible */}
          {!isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="outline-none">
                  <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                    {avatarUrl && <AvatarImage src={avatarUrl} />}
                    <AvatarFallback className="bg-white/[0.08] text-foreground text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-white/[0.08]">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate max-w-[200px]">
                  {user?.email}
                </div>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <DropdownMenuItem className="text-foreground" onClick={() => navigate("/settings")}>
                  <Settings className="h-3.5 w-3.5 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Hamburger — Mobile */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-14 z-[60] backdrop-blur-2xl bg-black/80 border-b border-white/[0.08] shadow-2xl"
          >
            <div className="p-4 space-y-1">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-white/[0.04]">
                <Avatar className="h-10 w-10">
                  {avatarUrl && <AvatarImage src={avatarUrl} />}
                  <AvatarFallback className="bg-white/[0.08] text-foreground text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user?.user_metadata?.full_name || "Trader"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>

              {/* Navigation */}
              {navItems.map((item) => (
                <button
                  key={item.title}
                  onClick={() => handleMobileNav(item.url)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-white/[0.06] transition-colors"
                >
                  {item.title}
                </button>
              ))}

              <div className="h-px bg-white/[0.08] my-2" />

              <button onClick={() => handleMobileNav("/settings")} className="w-full text-left px-4 py-3 rounded-xl text-sm text-foreground hover:bg-white/[0.06] transition-colors flex items-center gap-3">
                <Settings className="h-4 w-4 text-muted-foreground" /> Settings
              </button>
              <button onClick={() => handleMobileNav("/settings")} className="w-full text-left px-4 py-3 rounded-xl text-sm text-foreground hover:bg-white/[0.06] transition-colors flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Billing
              </button>
              <button onClick={() => { setMobileMenuOpen(false); startTour(); }} className="w-full text-left px-4 py-3 rounded-xl text-sm text-foreground hover:bg-white/[0.06] transition-colors flex items-center gap-3">
                <HelpCircle className="h-4 w-4 text-muted-foreground" /> Help & Tour
              </button>

              {isAdmin && (
                <button onClick={() => handleMobileNav("/admin")} className="w-full text-left px-4 py-3 rounded-xl text-sm text-foreground hover:bg-white/[0.06] transition-colors flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" /> Admin
                </button>
              )}

              {!isPro && (
                <button
                  onClick={() => { setMobileMenuOpen(false); triggerUpgrade("Unlock all features."); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center gap-3"
                >
                  <Zap className="h-4 w-4" /> Upgrade to Pro
                </button>
              )}

              <div className="h-px bg-white/[0.08] my-2" />

              <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-3">
                <LogOut className="h-4 w-4" /> Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

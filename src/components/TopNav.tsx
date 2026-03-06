import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Settings, LogOut, BookOpen, Zap, Wrench, Target, Image, MessageSquare } from "lucide-react";
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
  const { isPro, triggerUpgrade } = usePlan();
  const navigate = useNavigate();

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "TR";

  const avatarUrl = user?.user_metadata?.avatar_url;

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 backdrop-blur-xl bg-black/40 border-b border-white/[0.08] shrink-0 z-50 sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-primary/40" />
        <span className="text-foreground text-lg tracking-[0.15em] hidden sm:inline" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
          Momentra
        </span>
      </div>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-1">
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

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {!isPro && (
          <button
            onClick={() => triggerUpgrade("Unlock broker auto sync, unlimited AI insights, and unlimited trade imports.")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-all hover:shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]"
          >
            <Zap className="h-3 w-3" /> Upgrade
          </button>
        )}

        {/* Tools Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors outline-none">
              <Wrench className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-white/[0.08]">
            <DropdownMenuItem className="text-foreground gap-2" onClick={() => onBackgroundsClick?.()}>
              <Image className="h-3.5 w-3.5" /> Backgrounds
            </DropdownMenuItem>
            <DropdownMenuItem className="text-foreground gap-2" onClick={() => onFocusClick?.()}>
              <Target className="h-3.5 w-3.5" /> Focus Timer
            </DropdownMenuItem>
            <DropdownMenuItem className="text-foreground gap-2" onClick={() => onFeedbackClick?.()}>
              <MessageSquare className="h-3.5 w-3.5" /> Feedback
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

        <NavLink
          to="/settings"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
          activeClassName="!text-foreground !bg-white/[0.08]"
        >
          <Settings className="h-4 w-4" />
        </NavLink>

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
      </div>
    </header>
  );
}

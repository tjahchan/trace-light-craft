import { NavLink } from "@/components/NavLink";
import { Settings, User, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const navItems = [
  { title: "Dashboard", url: "/", badge: "1" },
  { title: "Overview", url: "/overview", badge: "2" },
  { title: "Notes", url: "/journal", badge: "3" },
  { title: "Leaderboard", url: "/community", badge: "4" },
];

export function TopNav() {
  const { user, signOut } = useAuth();
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
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-sm">T</span>
        </div>
        <span className="text-foreground font-semibold text-lg tracking-tight hidden sm:inline">
          TradeLog
        </span>
      </div>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-white/[0.05]"
            activeClassName="!text-foreground !bg-white/[0.08] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:bg-primary after:rounded-full"
          >
            <span>{item.title}</span>
            <span className="h-4 w-4 rounded-full bg-white/[0.08] text-[10px] flex items-center justify-center text-muted-foreground font-mono">
              {item.badge}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Right Side */}
      <div className="flex items-center gap-2">
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

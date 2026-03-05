import { TopNav } from "@/components/TopNav";
import { BackgroundSwitcher } from "@/components/BackgroundSwitcher";
import { useBackground, backgrounds } from "@/contexts/BackgroundContext";

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme } = useBackground();
  const bg = backgrounds[theme];

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Layer */}
      {bg.image && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${bg.image})` }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}
      {!bg.image && <div className="fixed inset-0 z-0 bg-background" />}

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 overflow-auto p-6 page-transition">
          {children}
        </main>
      </div>

      {/* Background Switcher */}
      <BackgroundSwitcher />
    </div>
  );
}

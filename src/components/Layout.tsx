import { useState, useEffect } from "react";
import { TopNav } from "@/components/TopNav";
import { BackgroundSwitcher } from "@/components/BackgroundSwitcher";
import { FocusWidget } from "@/components/FocusWidget";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { MomentraAI } from "@/components/MomentraAI";
import { PlatformTour } from "@/components/PlatformTour";
import { useBackground, backgrounds } from "@/contexts/BackgroundContext";

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme } = useBackground();
  const bg = backgrounds[theme];

  const [prevImage, setPrevImage] = useState<string | null>(bg.image);
  const [transitioning, setTransitioning] = useState(false);

  // Panel states triggered from TopNav tools dropdown
  const [focusOpen, setFocusOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    if (bg.image !== prevImage) {
      setTransitioning(true);
      const timer = setTimeout(() => {
        setPrevImage(bg.image);
        setTransitioning(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [bg.image, prevImage]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Layer with crossfade */}
      {prevImage && (
        <div
          className="fixed inset-0 z-0 bg-no-repeat"
          style={{
            backgroundImage: `url(${prevImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundAttachment: "fixed",
            transition: "opacity 0.6s ease",
            opacity: transitioning ? 0 : 1,
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}
      {transitioning && bg.image && (
        <div
          className="fixed inset-0 z-0 bg-no-repeat"
          style={{
            backgroundImage: `url(${bg.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundAttachment: "fixed",
            opacity: 1,
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}
      {!bg.image && !transitioning && <div className="fixed inset-0 z-0 bg-background" />}

      {/* Content */}
      <div className="relative z-[10] flex flex-col min-h-screen">
        <TopNav
          onFocusClick={() => setFocusOpen(true)}
          onBackgroundsClick={() => setBgOpen(true)}
          onFeedbackClick={() => setFeedbackOpen(true)}
        />
        <main className="flex-1 overflow-auto p-6 page-transition">
          {children}
        </main>
      </div>

      {/* Panels triggered by toolbar */}
      <FocusWidget externalOpen={focusOpen} onExternalClose={() => setFocusOpen(false)} />
      <BackgroundSwitcher externalOpen={bgOpen} onExternalClose={() => setBgOpen(false)} />
      <FeedbackWidget externalOpen={feedbackOpen} onExternalClose={() => setFeedbackOpen(false)} />

      {/* Momentra AI — fixed bottom-left */}
      <MomentraAI />

      {/* Platform Tour */}
      <PlatformTour />
    </div>
  );
}

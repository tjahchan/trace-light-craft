import { brokersWithLogos } from "@/lib/broker-config";

/**
 * Infinite-scroll broker logo marquee for the landing page.
 * Pure CSS animation — no JS timers.
 */
export function BrokerLogoStrip() {
  // Double the list so the marquee loops seamlessly
  const logos = [...brokersWithLogos, ...brokersWithLogos];

  return (
    <div className="w-full overflow-hidden py-8">
      <p className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-6">
        Auto-sync with your broker
      </p>
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

        <div className="flex animate-marquee gap-10 w-max hover:[animation-play-state:paused]">
          {logos.map((broker, i) => (
            <div
              key={`${broker.id}-${i}`}
              className="flex items-center justify-center h-14 w-14 shrink-0 hover:scale-110 transition-transform duration-500"
            >
              <img
                src={broker.logo}
                alt={broker.name}
                className="h-12 w-12 object-contain rounded-xl"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

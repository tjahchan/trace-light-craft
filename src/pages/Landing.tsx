import { LandingHero } from "@/components/landing/LandingHero";
import { LandingProblem } from "@/components/landing/LandingProblem";
import { LandingProduct } from "@/components/landing/LandingProduct";
import { LandingAI } from "@/components/landing/LandingAI";
import { LandingLoop } from "@/components/landing/LandingLoop";
import { LandingAnalytics } from "@/components/landing/LandingAnalytics";
import { LandingCTA } from "@/components/landing/LandingCTA";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingHero />
      <LandingProblem />
      <LandingProduct />
      <LandingAI />
      <LandingLoop />
      <LandingAnalytics />
      <LandingCTA />
    </div>
  );
}

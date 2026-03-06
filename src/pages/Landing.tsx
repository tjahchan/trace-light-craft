import { LandingHero } from "@/components/landing/LandingHero";
import { LandingProblem } from "@/components/landing/LandingProblem";
import { LandingAI } from "@/components/landing/LandingAI";
import { LandingProduct } from "@/components/landing/LandingProduct";
import { LandingLoop } from "@/components/landing/LandingLoop";
import { LandingAnalytics } from "@/components/landing/LandingAnalytics";
import { LandingCTA } from "@/components/landing/LandingCTA";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingHero />
      <LandingProblem />
      <LandingAI />
      <LandingProduct />
      <LandingLoop />
      <LandingAnalytics />
      <LandingCTA />
    </div>
  );
}

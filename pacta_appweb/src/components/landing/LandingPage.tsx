"use client";

import { LandingNavbar } from "./LandingNavbar";
import { HeroSection } from "./HeroSection";
import { FeaturesSection } from "./FeaturesSection";
import { AboutSection } from "./AboutSection";
import { FaqSection } from "./FaqSection";
import { ContactSection } from "./ContactSection";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <AboutSection />
        <FaqSection />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  );
}

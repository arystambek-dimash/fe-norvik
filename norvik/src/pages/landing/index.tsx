import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { ROUTES } from "@/lib/constants";
import { Navbar } from "./sections/navbar";
import { Hero } from "./sections/hero";
import { Features } from "./sections/features";
import { HowItWorks } from "./sections/how-it-works";
import { Stats } from "./sections/stats";
import { Cta } from "./sections/cta";
import { Footer } from "./sections/footer";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />;

  return (
    <div className="scroll-smooth">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <Cta />
      <Footer />
    </div>
  );
}

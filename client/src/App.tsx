import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profiles";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";

// Pages
import Home from "@/pages/Home";
import ProfilePage from "@/pages/Profile";
import Onboarding from "@/pages/Onboarding";
import MessagesPage from "@/pages/Messages";
import SettingsPage from "@/pages/Settings";
import EditProfilePage from "@/pages/EditProfile";
import PrivacyPolicyPage from "@/pages/PrivacyPolicy";
import TermsOfUsePage from "@/pages/TermsOfUse";
import AdminPage from "@/pages/Admin";
import LoginPage from "@/pages/Login";
import AboutPage from "@/pages/About";

import Footer from "@/components/Footer";
import LoadingScreen from "@/components/LoadingScreen";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useMyProfile();
  const [location, setLocation] = useLocation();
  const showLoadingScreen = isLoading || (isAuthenticated && isProfileLoading);

  // Auth Guard: If logged in but no profile, force onboarding
  useEffect(() => {
    // Only redirect if we ARE authenticated and we ARE NOT loading, but profile is explicitly null
    if (!isLoading && isAuthenticated && !isProfileLoading && profile === null && location !== "/onboarding") {
      console.log("Redirecting to onboarding: Auth'd but no profile");
      setLocation("/onboarding");
    }
    // If we have a profile and we're on onboarding, go home
    if (!isLoading && isAuthenticated && !isProfileLoading && profile && location === "/onboarding") {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, isProfileLoading, profile, location, setLocation]);

  // Auth Guard: If not logged in, protect private routes
  const ProtectedRoute = ({ component: Component, ...rest }: any) => {
    if (isLoading) return null;
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return null;
    }
    return <Component {...rest} />;
  };

  if (showLoadingScreen) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/profile/:username" component={ProfilePage} />
          <Route path="/onboarding">
            {() => !isAuthenticated ? <Home /> : <Onboarding />} 
          </Route>
          <Route path="/messages">
            {() => <ProtectedRoute component={MessagesPage} />}
          </Route>
          <Route path="/settings">
            {() => <ProtectedRoute component={SettingsPage} />}
          </Route>
          <Route path="/edit-profile">
            {() => <ProtectedRoute component={EditProfilePage} />}
          </Route>
          <Route path="/privacy" component={PrivacyPolicyPage} />
          <Route path="/terms" component={TermsOfUsePage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/login">
            {() => isAuthenticated ? <Home /> : <LoginPage />}
          </Route>
          <Route path="/admin">
            {() => <ProtectedRoute component={AdminPage} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  useEffect(() => {
    fetch("/api/track-visit", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;

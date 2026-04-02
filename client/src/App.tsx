import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import FindParking from "@/pages/find-parking";
import ListLot from "@/pages/list-lot";
import LotDetail from "@/pages/lot-detail";
import Bookings from "@/pages/bookings";
import AuthPage from "@/pages/auth";
import ProfilePage from "@/pages/profile";
import OwnerDashboardPage from "@/pages/owner-dashboard";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/find" component={FindParking} />
      <Route path="/list" component={ListLot} />
      <Route path="/lot/:id" component={LotDetail} />
      <Route path="/bookings" component={Bookings} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/owner" component={OwnerDashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

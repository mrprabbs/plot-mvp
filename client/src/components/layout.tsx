import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useSessionUser } from "@/hooks/use-session-user";
import { apiRequest, queryClient } from "@/lib/queryClient";

function PlotLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  return (
    <img
      src="/plot-logo.png"
      alt="PLOT logo"
      className={`${sizeClass} object-contain`}
    />
  );
}

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useSessionUser();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/owner/lots"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/driver/reservations"] });
    },
  });

  const navLinks = [
    { href: "/find", label: "Find Parking" },
    ...(user?.role === "owner"
      ? [
          { href: "/owner", label: "Owner Dashboard" },
          { href: "/list", label: "Manage Lots" },
        ]
      : []),
    ...(user?.role === "driver" ? [{ href: "/bookings", label: "My Bookings" }] : []),
    ...(user ? [{ href: "/profile", label: "Profile" }] : [{ href: "/auth", label: "Sign In" }]),
  ];

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border" data-testid="navbar">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-primary" data-testid="link-home">
            <PlotLogo size="md" />
            <span className="font-display font-bold text-lg tracking-tight text-foreground">PLOT</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    location === link.href
                      ? "text-primary bg-primary/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  data-testid={`link-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border pt-3 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`block px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                    location === link.href
                      ? "text-primary bg-primary/8"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMobileOpen(false)}
                  data-testid={`link-mobile-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            {user && (
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setMobileOpen(false);
                  logoutMutation.mutate();
                }}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
              </Button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-primary">
            <PlotLogo size="sm" />
            <span className="font-display font-bold text-sm text-foreground">PLOT</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} PLOT. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

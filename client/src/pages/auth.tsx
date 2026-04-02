import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { PageLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Mode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "driver">("driver");

  const authMutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { fullName, email, password, role };

      const res = await apiRequest("POST", endpoint, payload);
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      toast({ title: mode === "login" ? "Welcome back" : "Account created" });

      const userRole = data?.user?.role as "owner" | "driver" | undefined;
      if (userRole === "owner") {
        setLocation("/owner");
      } else {
        setLocation("/find");
      }
    },
    onError: (err: Error) => {
      toast({ title: "Authentication failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <PageLayout>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create account"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                onClick={() => setMode("login")}
              >
                Login
              </Button>
              <Button
                type="button"
                variant={mode === "register" ? "default" : "outline"}
                onClick={() => setMode("register")}
              >
                Register
              </Button>
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <Label>I am joining as</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={role === "driver" ? "default" : "outline"}
                    onClick={() => setRole("driver")}
                  >
                    Driver
                  </Button>
                  <Button
                    type="button"
                    variant={role === "owner" ? "default" : "outline"}
                    onClick={() => setRole("owner")}
                  >
                    Owner
                  </Button>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => authMutation.mutate()}
              disabled={authMutation.isPending}
            >
              {authMutation.isPending
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Want to browse first? <Link href="/find" className="text-primary underline">Go to parking search</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

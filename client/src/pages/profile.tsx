import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSessionUser } from "@/hooks/use-session-user";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ProfilePage() {
  const { user, isLoading } = useSessionUser();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return res.json();
    },
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      toast({ title: "Password updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update password", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <PageLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 text-sm text-muted-foreground">Loading profile...</div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">You need to sign in to view your profile.</p>
              <Link href="/auth">
                <Button className="mt-4">Sign in</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> {user.fullName}</p>
            <p><span className="font-medium">Email:</span> {user.email}</p>
            <p><span className="font-medium">Role:</span> {user.role}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button onClick={() => changePasswordMutation.mutate()} disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Updating..." : "Update password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

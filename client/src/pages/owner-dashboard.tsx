import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSessionUser } from "@/hooks/use-session-user";
import { apiRequest, queryClient } from "@/lib/queryClient";

type OwnerAnalytics = {
  totalLots: number;
  activeLots: number;
  totalReservations: number;
  completedReservations: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  occupiedSpots: number;
  totalSpots: number;
};

type OwnerLot = {
  id: number;
  name: string;
  address: string;
  pricePerHour: number;
  totalSpots: number;
  availableSpots: number;
};

type OwnerReservation = {
  id: number;
  lotName: string;
  spotNumber: string;
  guestName: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
};

type ConnectStatus = {
  stripeAccountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

const currency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function OwnerDashboardPage() {
  const { user, isLoading: userLoading } = useSessionUser();
  const { toast } = useToast();

  const { data: lots, isLoading: lotsLoading } = useQuery<OwnerLot[]>({
    queryKey: ["/api/owner/lots"],
    enabled: user?.role === "owner",
  });

  const { data: reservations, isLoading: reservationsLoading } = useQuery<OwnerReservation[]>({
    queryKey: ["/api/owner/reservations"],
    enabled: user?.role === "owner",
  });

  const { data: analytics } = useQuery<OwnerAnalytics>({
    queryKey: ["/api/owner/analytics"],
    enabled: user?.role === "owner",
  });

  const { data: connectStatus, isLoading: connectLoading } = useQuery<ConnectStatus | null>({
    queryKey: ["/api/payments/connect/status"],
    queryFn: async () => {
      const res = await fetch("/api/payments/connect/status", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: user?.role === "owner",
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/connect/onboarding-link");
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      toast({ title: "Stripe onboarding failed", description: err.message, variant: "destructive" });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/payments/connect/status");
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/payments/connect/status"] });
      toast({ title: "Payout status refreshed" });
    },
  });

  if (userLoading) {
    return (
      <PageLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <Skeleton className="h-8 w-56" />
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Sign in as an owner to access your dashboard.</p>
              <Link href="/auth"><Button>Sign in</Button></Link>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (user.role !== "owner") {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Only owner accounts can access this dashboard.</p>
              <Link href="/find"><Button variant="outline">Browse parking</Button></Link>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight">Owner Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage lots, payouts, and reservations.</p>
          </div>
          <Link href="/list"><Button>Manage Lots</Button></Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stripe Connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {connectLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : connectStatus ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={connectStatus.detailsSubmitted ? "secondary" : "outline"}>
                  Details {connectStatus.detailsSubmitted ? "Submitted" : "Pending"}
                </Badge>
                <Badge variant={connectStatus.chargesEnabled ? "secondary" : "outline"}>
                  Charges {connectStatus.chargesEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Badge variant={connectStatus.payoutsEnabled ? "secondary" : "outline"}>
                  Payouts {connectStatus.payoutsEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Button variant="outline" onClick={() => refreshMutation.mutate()}>
                  Refresh Status
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Connect Stripe Express to receive payouts from bookings.
                </p>
                <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                  {connectMutation.isPending ? "Opening..." : "Start Stripe Onboarding"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-4 gap-3">
          <MetricCard title="Active lots" value={String(analytics?.activeLots ?? 0)} />
          <MetricCard title="Reservations" value={String(analytics?.totalReservations ?? 0)} />
          <MetricCard title="Net revenue" value={currency(analytics?.netRevenueCents ?? 0)} />
          <MetricCard title="Occupied spots" value={`${analytics?.occupiedSpots ?? 0}/${analytics?.totalSpots ?? 0}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Lots</CardTitle>
          </CardHeader>
          <CardContent>
            {lotsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : lots && lots.length > 0 ? (
              <div className="space-y-2">
                {lots.map((lot) => (
                  <div key={lot.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{lot.name}</p>
                      <p className="text-xs text-muted-foreground">{lot.address}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lot.availableSpots}/{lot.totalSpots} available · ${(lot.pricePerHour / 100).toFixed(2)}/hr
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No lots listed yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            {reservationsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : reservations && reservations.length > 0 ? (
              <div className="space-y-2">
                {reservations.slice(0, 10).map((reservation) => (
                  <div key={reservation.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{reservation.lotName} · Spot #{reservation.spotNumber}</p>
                      <p className="text-xs text-muted-foreground">{reservation.guestName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{reservation.status}</Badge>
                      <Badge variant="secondary">{reservation.paymentStatus}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reservations yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search,
  CalendarCheck,
  MapPin,
  Clock,
  XCircle,
  Mail,
  ParkingSquare,
} from "lucide-react";

type EnrichedReservation = {
  id: number;
  spotId: number;
  lotId: number;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
  lotName: string;
  lotAddress: string;
  spotNumber: string;
};

export default function Bookings() {
  const [email, setEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const { toast } = useToast();

  const { data: reservations, isLoading } = useQuery<EnrichedReservation[]>({
    queryKey: ["/api/reservations", `?email=${searchEmail}`],
    enabled: !!searchEmail,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/reservations/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Booking cancelled", description: "Your reservation has been cancelled." });
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations", `?email=${searchEmail}`] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSearchEmail(email.trim());
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
    } catch { return iso; }
  };

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl tracking-tight text-foreground">My Bookings</h1>
          <p className="text-muted-foreground text-sm mt-1">Look up your reservations by email</p>
        </div>

        {/* Email search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8" data-testid="form-search-bookings">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Enter your email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11"
              data-testid="input-booking-email-search"
            />
          </div>
          <Button type="submit" className="gap-2 h-11" data-testid="button-search-bookings">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </form>

        {/* Results */}
        {!searchEmail ? (
          <div className="text-center py-16" data-testid="empty-state-no-search">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-muted mb-4">
              <CalendarCheck className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">Enter your email to view bookings</h3>
            <p className="text-sm text-muted-foreground mt-1">We'll find all reservations linked to your email</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
            ))}
          </div>
        ) : reservations && reservations.length > 0 ? (
          <div className="space-y-3">
            {reservations.map((r) => (
              <Card key={r.id} data-testid={`card-reservation-${r.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-foreground truncate">{r.lotName}</h3>
                        <Badge
                          variant={r.status === "confirmed" ? "secondary" : "destructive"}
                          className="text-[10px] uppercase tracking-wider"
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="text-xs truncate">{r.lotAddress}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ParkingSquare className="h-3 w-3" />
                          Spot #{r.spotNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(r.startTime)} → {formatDate(r.endTime)}
                        </span>
                      </div>
                    </div>

                    {r.status === "confirmed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive gap-1 flex-shrink-0"
                        onClick={() => cancelMutation.mutate(r.id)}
                        disabled={cancelMutation.isPending}
                        data-testid={`button-cancel-${r.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16" data-testid="empty-state-no-bookings">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-muted mb-4">
              <CalendarCheck className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground">No bookings found</h3>
            <p className="text-sm text-muted-foreground mt-1">No reservations linked to {searchEmail}</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

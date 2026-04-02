import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MapPin,
  DollarSign,
  Clock,
  Car,
  ArrowLeft,
  CheckCircle,
  XCircle,
  CalendarCheck,
} from "lucide-react";
import type { ParkingLotWithSpots, ParkingSpot } from "@shared/schema";

const bookingSchema = z.object({
  guestName: z.string().min(2, "Name is required"),
  guestEmail: z.string().email("Valid email required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export default function LotDetail() {
  const [, params] = useRoute("/lot/:id");
  const lotId = params?.id ? parseInt(params.id, 10) : null;
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const { toast } = useToast();

  const { data: lot, isLoading } = useQuery<ParkingLotWithSpots>({
    queryKey: ["/api/lots", lotId],
    enabled: !!lotId,
  });

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestName: "",
      guestEmail: "",
      startTime: "",
      endTime: "",
    },
  });

  const bookMutation = useMutation({
    mutationFn: async (data: BookingFormValues) => {
      const res = await apiRequest("POST", "/api/reservations", {
        spotId: selectedSpot!.id,
        lotId: lotId,
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        startTime: data.startTime,
        endTime: data.endTime,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking confirmed!",
        description: `Spot ${selectedSpot?.spotNumber} has been reserved. Check your bookings page.`,
      });
      setBookingOpen(false);
      setSelectedSpot(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/lots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lots", lotId] });
    },
    onError: (err: Error) => {
      toast({
        title: "Booking failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitBooking = (data: BookingFormValues) => {
    bookMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-5 w-full mb-4" />
          <Skeleton className="h-5 w-3/4 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!lot) {
    return (
      <PageLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="font-display font-bold text-xl text-foreground mb-2">Lot not found</h2>
          <p className="text-muted-foreground text-sm mb-4">
            This parking lot doesn't exist or may have been removed.
          </p>
          <Link href="/find">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Search
            </Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const priceDisplay = (lot.pricePerHour / 100).toFixed(2);

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link href="/find">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6" data-testid="link-back-search">
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </button>
        </Link>

        {/* Lot info */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl tracking-tight text-foreground" data-testid="text-lot-name">
            {lot.name}
          </h1>
          <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
            <MapPin className="h-4 w-4" />
            <span className="text-sm" data-testid="text-lot-address">{lot.address}</span>
          </div>
          {lot.description && (
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              {lot.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Badge variant="secondary" className="gap-1.5 text-sm font-medium py-1 px-3">
              <DollarSign className="h-3.5 w-3.5" />
              ${priceDisplay}/hr
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-sm font-medium py-1 px-3">
              <Car className="h-3.5 w-3.5" />
              {lot.availableSpots} of {lot.totalSpots} available
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-sm py-1 px-3">
              <Clock className="h-3.5 w-3.5" />
              {lot.operatingHoursOpen} – {lot.operatingHoursClose}
            </Badge>
          </div>
        </div>

        {/* Spots grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              Parking Spots
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lot.spots && lot.spots.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {lot.spots.map((spot) => (
                  <button
                    key={spot.id}
                    className={`
                      relative rounded-lg border p-3 text-center transition-all
                      ${
                        spot.isAvailable
                          ? "border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 cursor-pointer"
                          : "border-border bg-muted cursor-not-allowed opacity-50"
                      }
                      ${
                        selectedSpot?.id === spot.id
                          ? "ring-2 ring-primary border-primary bg-primary/15"
                          : ""
                      }
                    `}
                    onClick={() => {
                      if (spot.isAvailable) {
                        setSelectedSpot(spot);
                        setBookingOpen(true);
                      }
                    }}
                    disabled={!spot.isAvailable}
                    data-testid={`button-spot-${spot.id}`}
                  >
                    <div className="text-xs font-medium text-foreground">
                      #{spot.spotNumber}
                    </div>
                    <div className="mt-1">
                      {spot.isAvailable ? (
                        <CheckCircle className="h-4 w-4 text-primary mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No spots configured for this lot.</p>
            )}

            <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-primary/15 border border-primary/30" />
                Available
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-muted border border-border" />
                Occupied
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Book Spot #{selectedSpot?.spotNumber}
            </DialogTitle>
            <DialogDescription>
              {lot.name} — ${priceDisplay}/hr
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitBooking)} className="space-y-4 mt-2">
              <FormField
                control={form.control}
                name="guestName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-booking-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guestEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        data-testid="input-booking-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-booking-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-booking-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2 font-semibold"
                disabled={bookMutation.isPending}
                data-testid="button-confirm-booking"
              >
                {bookMutation.isPending ? "Booking..." : (
                  <>
                    <CalendarCheck className="h-4 w-4" />
                    Confirm Booking
                  </>
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

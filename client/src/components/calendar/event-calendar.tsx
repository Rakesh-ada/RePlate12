import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertEventSchema, type Event, type EventWithCreator } from "@shared/schema";
import { format, parseISO, isSameDay } from "date-fns";
import { CalendarDays, Clock, MapPin, Phone, Plus, Edit, Trash2 } from "lucide-react";
import { z } from "zod";

const eventFormSchema = insertEventSchema.omit({ createdBy: true }).extend({
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  phoneNumber: z.string()
    .min(1, "Phone number is required")
    .regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number")
    .refine((val) => val.length >= 10, "Phone number must be at least 10 digits"),
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventCalendarProps {
  className?: string;
}

export function EventCalendar({ className }: EventCalendarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Fetch events
  const { data: events = [], isLoading: eventsLoading } = useQuery<EventWithCreator[]>({
    queryKey: ["/api/events"],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: "",
      endTime: "",
      location: "",
      phoneNumber: "",
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const response = await apiRequest("POST", "/api/events", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create event");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event Created",
        description: "Your event has been created successfully.",
      });
      setIsCreateModalOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventFormData> }) => {
      const response = await apiRequest("PUT", `/api/events/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update event");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event Updated",
        description: "Your event has been updated successfully.",
      });
      setEditingEvent(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/events/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete event");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event Deleted",
        description: "The event has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Phone verification mutation
  const verifyPhoneMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest("POST", "/api/verify-phone", { phoneNumber });
      if (!response.ok) {
        throw new Error("Failed to verify phone number");
      }
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      if (data.valid) {
        setPhoneVerified(true);
        toast({
          title: "Phone Number Verified",
          description: "Phone number is valid and belongs to a real person.",
        });
      } else {
        setPhoneVerified(false);
        toast({
          title: "Invalid Phone Number",
          description: "Please enter a valid phone number that belongs to a real person.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setPhoneVerified(false);
      toast({
        title: "Verification Failed",
        description: "Could not verify phone number. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    if (!phoneVerified) {
      toast({
        title: "Phone Number Not Verified",
        description: "Please verify your phone number before creating the event.",
        variant: "destructive",
      });
      return;
    }
    
    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data });
    } else {
      createEventMutation.mutate(data);
    }
  };

  const handlePhoneVerification = () => {
    const phoneNumber = form.getValues("phoneNumber");
    if (!phoneNumber) {
      toast({
        title: "Phone Number Required",
        description: "Please enter a phone number first.",
        variant: "destructive",
      });
      return;
    }
    setIsVerifyingPhone(true);
    verifyPhoneMutation.mutate(phoneNumber, {
      onSettled: () => setIsVerifyingPhone(false),
    });
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description || "",
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      phoneNumber: event.phoneNumber || "",
    });
  };

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setEditingEvent(null);
    setPhoneVerified(false);
    form.reset();
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate
    ? events.filter((event) =>
        isSameDay(parseISO(event.startTime), selectedDate)
      )
    : [];

  // Get upcoming events (next 7 days)
  const upcomingEvents = events
    .filter((event) => new Date(event.startTime) >= new Date())
    .slice(0, 5);

  // Check if a date has events
  const dateHasEvents = (date: Date) => {
    return events.some((event) => isSameDay(parseISO(event.startTime), date));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Event Calendar</h2>
        <Dialog 
          open={isCreateModalOpen || editingEvent !== null} 
          onOpenChange={(open) => !open && closeModal()}
        >
          <DialogTrigger asChild>
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-forest hover:bg-forest-dark text-white"
              data-testid="button-create-event"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Edit Event" : "Create New Event"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Title</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter event title"
                          data-testid="input-event-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""}
                          placeholder="Enter event description"
                          data-testid="input-event-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="datetime-local"
                            className="[&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:filter-none"
                            data-testid="input-event-start-time"
                          />
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
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="datetime-local"
                            className="[&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:filter-none"
                            data-testid="input-event-end-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter event location"
                          data-testid="input-event-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            {...field} 
                            type="tel"
                            placeholder="Enter contact phone number"
                            data-testid="input-event-phone"
                            className="flex-1"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          onClick={handlePhoneVerification}
                          disabled={isVerifyingPhone || !field.value}
                          variant="outline"
                          className="shrink-0"
                        >
                          {isVerifyingPhone ? "Verifying..." : phoneVerified ? "✓ Verified" : "Verify"}
                        </Button>
                      </div>
                      {phoneVerified && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          ✓ Phone number verified and belongs to a real person
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createEventMutation.isPending || updateEventMutation.isPending}
                    className="flex-1 bg-forest hover:bg-forest-dark text-white"
                    data-testid="button-save-event"
                  >
                    {createEventMutation.isPending || updateEventMutation.isPending
                      ? "Saving..." 
                      : editingEvent 
                        ? "Update Event" 
                        : "Create Event"
                    }
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={closeModal}
                    data-testid="button-cancel-event"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border [&_.rdp-table]:w-full [&_.rdp-tbody]:space-y-1 [&_.rdp-row]:space-x-1 [&_.rdp-cell]:p-1 [&_.rdp-button]:h-8 [&_.rdp-button]:w-8 [&_.rdp-button]:text-sm"
              modifiers={{
                hasEvents: (date) => dateHasEvents(date),
              }}
              modifiersStyles={{
                hasEvents: { backgroundColor: "#15803d", color: "white", fontWeight: "bold" },
              }}
              data-testid="calendar-view"
            />
            
            {selectedDate && (
              <div className="mt-3">
                <h4 className="font-semibold mb-2 text-sm">
                  Events on {format(selectedDate, "MMMM d, yyyy")}
                </h4>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-gray-500 text-xs">No events on this date</p>
                ) : (
                                      <div className="space-y-2">
                      {selectedDateEvents.map((event) => (
                        <div 
                          key={event.id} 
                          className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-800"
                          data-testid={`event-card-${event.id}`}
                        >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium">{event.title}</h5>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(parseISO(event.startTime), "h:mm a")} - {format(parseISO(event.endTime), "h:mm a")}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                              {event.phoneNumber && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {event.phoneNumber}
                                </span>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(event)}
                              data-testid={`button-edit-event-${event.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteEventMutation.mutate(event.id)}
                              disabled={deleteEventMutation.isPending}
                              data-testid={`button-delete-event-${event.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {eventsLoading ? (
              <p className="text-xs text-gray-500">Loading events...</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-xs text-gray-500">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    data-testid={`upcoming-event-${event.id}`}
                  >
                    <h5 className="font-medium text-sm">{event.title}</h5>
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(event.startTime), "MMM d, h:mm a")}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
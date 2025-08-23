import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertFoodItemSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { FoodItem, FoodDonationWithDetails } from "@shared/schema";

interface CampusStats {
  totalMealsSaved: number;
  activeStudents: number;
  partnerCanteens: number;
  totalSavings: number;
  foodProvided: number;
  wastedFood: number;
  claimedFood: number;
  carbonFootprintSaved: number;
  waterFootprintSaved: number;
}
import { Plus, Utensils, TrendingUp, DollarSign, Edit, Trash2, MoreHorizontal, ShieldCheck, CheckCircle, Heart, Users, Phone, User, Clock, AlertTriangle, Leaf, Droplets, Recycle, CheckSquare, Package, Calendar } from "lucide-react";
import { EventCalendar } from "@/components/calendar/event-calendar";
import { formatTimeRemaining } from "@/lib/qr-utils";
import { z } from "zod";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const formSchema = insertFoodItemSchema.omit({ createdBy: true }).extend({
  availableUntil: z.string().min(1, "Available until time is required"),
  imageUrl: z.string().optional(),
  canteenLocation: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [ngoModalOpen, setNgoModalOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<FoodDonationWithDetails | null>(null);
  const [ngoForm, setNgoForm] = useState({
    ngoName: "",
    ngoContactPerson: "",
    ngoPhoneNumber: "",
  });

  // Redirect if not admin
  if (!authLoading && (!user || user.role !== "admin")) {
    setTimeout(() => {
      window.location.href = "/";
    }, 500);
    return null;
  }

  const { data: myItems = [], isLoading: itemsLoading } = useQuery<FoodItem[]>({
    queryKey: ["/api/food-items/my"],
    enabled: !!user && user.role === "admin",
  });

  // Fetch donations
  const { data: donations = [], isLoading: donationsLoading } = useQuery<FoodDonationWithDetails[]>({
    queryKey: ["/api/donations"],
    enabled: !!user && user.role === "admin",
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      canteenName: "",
      canteenLocation: "",
      quantityAvailable: 1,
      imageUrl: "",
      availableUntil: "",
      isActive: true,
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Transform the data to match the backend schema
      const transformedData = {
        ...data,
        availableUntil: data.availableUntil, // Keep as string for timestamp mode
        imageUrl: data.imageUrl || null,
        canteenLocation: data.canteenLocation || null,
      };
      
      const response = await apiRequest("POST", "/api/food-items", transformedData);
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.message || "Failed to create food item");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Food Item Added",
        description: "Your food item has been added successfully.",
      });
      setAddItemModalOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/food-items/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Add Item",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: FormData & { id: string }) => {
      const { id, ...updateData } = data;
      // Transform the data to match the backend schema
      const transformedData = {
        ...updateData,
        availableUntil: updateData.availableUntil, // Keep as string for timestamp mode
        imageUrl: updateData.imageUrl || null,
        canteenLocation: updateData.canteenLocation || null,
      };
      
      const response = await apiRequest("PUT", `/api/food-items/${id}`, transformedData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Food Item Updated",
        description: "Your food item has been updated successfully.",
      });
      setEditingItem(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/food-items/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Update Item",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/food-items/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Food Item Deleted",
        description: "The food item has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Delete Item",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyClaimMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/food-claims/verify", { claimCode: code });
      return response.json();
    },
    onSuccess: (result) => {
      setVerificationResult(result);
      if (result.success) {
        toast({
          title: "Claim Verified",
          description: `Meal "${result.claim.foodItem.name}" verified for student.`,
        });
      } else {
        toast({
          title: "Verification Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Verification Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Donation mutations
  const transferExpiredMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/donations/transfer-expired", {});
      if (!response.ok) {
        throw new Error("Failed to transfer expired items");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Expired Items Transferred",
        description: `${data.transferredCount} expired food items have been transferred to donations.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-items/my"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to transfer expired items.",
        variant: "destructive",
      });
    },
  });

  const reserveDonationMutation = useMutation({
    mutationFn: async ({ id, ngoInfo }: { id: string; ngoInfo: any }) => {
      const response = await apiRequest("PUT", `/api/donations/${id}/reserve`, ngoInfo);
      if (!response.ok) {
        throw new Error("Failed to reserve donation");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Donation Reserved",
        description: "The food item has been reserved for NGO collection.",
      });
      setNgoModalOpen(false);
      setSelectedDonation(null);
      setNgoForm({ ngoName: "", ngoContactPerson: "", ngoPhoneNumber: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reserve donation.",
        variant: "destructive",
      });
    },
  });

  const collectDonationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/donations/${id}/collect`, {});
      if (!response.ok) {
        throw new Error("Failed to mark donation as collected");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Donation Collected",
        description: "The food item has been marked as collected by NGO.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark donation as collected.",
        variant: "destructive",
      });
    },
  });

  const completeClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const response = await apiRequest("POST", `/api/food-claims/${claimId}/complete`, {});
      return response.json();
    },
    onSuccess: () => {
      setVerificationResult(null);
      setClaimCode("");
      toast({
        title: "Meal Collected",
        description: "Student has successfully collected their meal.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete claim.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ ...data, id: editingItem.id });
    } else {
      addItemMutation.mutate(data);
    }
  };

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item);
    const availableUntil = new Date(item.availableUntil);
    const localDateTime = new Date(availableUntil.getTime() - availableUntil.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    
    form.reset({
      name: item.name,
      description: item.description || "",
      canteenName: item.canteenName,
      canteenLocation: item.canteenLocation || "",
      quantityAvailable: item.quantityAvailable,
      imageUrl: item.imageUrl || "",
      availableUntil: localDateTime,
      isActive: item.isActive,
    });
    setAddItemModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this food item?")) {
      deleteItemMutation.mutate(id);
    }
  };

  const handleModalClose = () => {
    setAddItemModalOpen(false);
    setEditingItem(null);
    form.reset();
  };

  // Fetch comprehensive stats
  const { data: stats, isLoading: statsLoading } = useQuery<CampusStats>({
    queryKey: ["/api/stats"],
    enabled: !!user && user.role === "admin",
  });

  // Calculate local stats
  const activeItems = myItems.filter(item => item.isActive).length;
  const totalQuantity = myItems.reduce((sum, item) => sum + item.quantityAvailable, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage food items and verify student claims
          </p>
        </div>

        {/* Comprehensive Stats Dashboard */}
        <div className="space-y-8 mb-8">
          {/* Primary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-gray-900 dark:text-white font-semibold text-xl">{stats?.foodProvided || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Food Provided</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-gray-900 dark:text-white font-semibold text-xl">{stats?.claimedFood || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Successfully Claimed</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-gray-900 dark:text-white font-semibold text-xl">{stats?.wastedFood || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Food Wasted</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-gray-900 dark:text-white font-semibold text-xl">{activeItems}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Currently Active</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Environmental Impact */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-gray-900 dark:text-white font-semibold text-xl">{(stats?.carbonFootprintSaved || 0).toFixed(1)} kg</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">CO₂ Saved</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-gray-900 dark:text-white font-semibold text-xl">{(stats?.waterFootprintSaved || 0).toLocaleString()} L</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Water Saved</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-gray-900 dark:text-white font-semibold text-xl">{stats?.totalMealsSaved || 0}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Meals Saved</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-gray-900 dark:text-white font-semibold text-xl">{((stats?.wastedFood || 0) === 0 ? 100 : Math.max(0, 100 - ((stats?.wastedFood || 0) / (stats?.foodProvided || 1)) * 100)).toFixed(0)}%</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Waste Reduction</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="verify" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="verify">Verify Claims</TabsTrigger>
            <TabsTrigger value="manage">Manage Items</TabsTrigger>
            <TabsTrigger value="unclaimed">Unclaimed</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verify" className="space-y-6">
            {/* Claim Code Verification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Verify Claim Code
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400">
                  Enter a student's claim code to verify and complete meal collection
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Input
                      placeholder="Enter claim code (e.g., ABC-XYZ)"
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                      className="flex-1"
                      maxLength={7}
                    />
                    <Button
                      onClick={() => verifyClaimMutation.mutate(claimCode)}
                      disabled={!claimCode.trim() || verifyClaimMutation.isPending}
                      className="bg-forest hover:bg-forest-dark text-white"
                    >
                      {verifyClaimMutation.isPending ? "Verifying..." : "Verify"}
                    </Button>
                  </div>

                  {verificationResult && (
                    <div className="mt-4 p-4 border rounded-lg">
                      {verificationResult.success ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Valid Claim
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Student:</strong> {verificationResult.claim.user.firstName} {verificationResult.claim.user.lastName}
                            </div>
                            <div>
                              <strong>Email:</strong> {verificationResult.claim.user.email}
                            </div>
                            <div>
                              <strong>Meal:</strong> {verificationResult.claim.foodItem.name}
                            </div>
                            <div>
                              <strong>Canteen:</strong> {verificationResult.claim.foodItem.canteenName}
                            </div>
                            <div>
                              <strong>Status:</strong> <span className="text-green-600 font-medium">FREE</span>
                            </div>
                            <div>
                              <strong>Status:</strong> {verificationResult.claim.status}
                            </div>
                          </div>
                          <Button
                            onClick={() => completeClaimMutation.mutate(verificationResult.claim.id)}
                            disabled={completeClaimMutation.isPending}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                          >
                            {completeClaimMutation.isPending ? "Processing..." : "Complete Collection"}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-red-600">
                          <Badge variant="destructive">Invalid</Badge>
                          <p className="mt-2">{verificationResult.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            {/* Add Item Button */}
            <div className="flex justify-end">
              <Button 
                onClick={() => setAddItemModalOpen(true)}
                className="bg-forest hover:bg-forest-dark text-white"
                data-testid="button-add-new-item"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Item
              </Button>
              
              <Dialog open={addItemModalOpen} onOpenChange={handleModalClose}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="dialog-description">
                <DialogHeader>
                  <DialogTitle>
                    {editingItem ? "Edit Food Item" : "Add New Food Item"}
                  </DialogTitle>
                  <p id="dialog-description" className="text-sm text-gray-600 dark:text-gray-400">
                    {editingItem ? "Update the details for this food item" : "Fill in the details to add a new food item to your canteen"}
                  </p>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Food Item Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Grilled Chicken Sandwich" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="canteenName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Canteen Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., North Campus Dining" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the food item..."
                              className="min-h-[80px]"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="quantityAvailable"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity Available</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              placeholder="5" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="availableUntil"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Available Until</FormLabel>
                            <FormControl>
                              <Input 
                                type="datetime-local" 
                                {...field}
                                data-testid="input-available-until"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Image URL (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="https://example.com/image.jpg" 
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="canteenLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Canteen Location (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Building A, Floor 1" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleModalClose}
                        disabled={addItemMutation.isPending || updateItemMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-forest hover:bg-forest-dark text-white"
                        disabled={addItemMutation.isPending || updateItemMutation.isPending}
                        data-testid="button-submit-item"

                      >
                        {addItemMutation.isPending || updateItemMutation.isPending 
                          ? "Saving..." 
                          : editingItem 
                            ? "Update Item" 
                            : "Add Item"
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            </div>

            {/* Food Items Table */}
            <Card>
          <CardHeader>
            <CardTitle>Your Food Items</CardTitle>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-800 rounded-lg">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4"></div>
                    </div>
                    <div className="w-20 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : myItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Utensils className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No food items yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start by adding your first food item to the system.
                </p>
                <Button 
                  onClick={() => setAddItemModalOpen(true)}
                  className="bg-forest hover:bg-forest-dark text-white"
                  data-testid="button-add-first-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Food Item</TableHead>
                      <TableHead>Canteen</TableHead>
                      <TableHead>Quantity Available</TableHead>
                      <TableHead>Expires In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <Utensils className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {item.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          {item.canteenName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 dark:text-white font-medium">
                              {item.quantityAvailable}
                            </span>
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                              FREE
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          {formatTimeRemaining(item.availableUntil.toString())}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.isActive ? "default" : "secondary"}>
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(item)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(item.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="unclaimed" className="space-y-6">
            {/* Expiry Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Expiry Status Monitor
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400">
                  Monitor unclaimed food items approaching expiry. Items automatically transfer to waste after expiry time.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-800 dark:text-red-200">Expired</span>
                    </div>
                    <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                      {myItems.filter(item => new Date(item.availableUntil) < new Date()).length}
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">Auto-transferred to waste</p>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-800 dark:text-orange-200">Critical</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                      {myItems.filter(item => {
                        const now = new Date();
                        const expiryTime = new Date(item.availableUntil);
                        const timeDiff = expiryTime.getTime() - now.getTime();
                        return timeDiff > 0 && timeDiff <= 30 * 60 * 1000; // 30 minutes
                      }).length}
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">Within 30 minutes</p>
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800 dark:text-yellow-200">Warning</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                      {myItems.filter(item => {
                        const now = new Date();
                        const expiryTime = new Date(item.availableUntil);
                        const timeDiff = expiryTime.getTime() - now.getTime();
                        return timeDiff > 30 * 60 * 1000 && timeDiff <= 2 * 60 * 60 * 1000; // 30 min to 2 hours
                      }).length}
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Within 2 hours</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800 dark:text-green-200">Active</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                      {myItems.filter(item => {
                        const now = new Date();
                        const expiryTime = new Date(item.availableUntil);
                        const timeDiff = expiryTime.getTime() - now.getTime();
                        return timeDiff > 2 * 60 * 60 * 1000; // More than 2 hours
                      }).length}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">Available for claims</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Unclaimed Items List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Unclaimed Food Items
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400">
                  Items that haven't been claimed will automatically transfer to waste after expiry time.
                </p>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading items...</p>
                  </div>
                ) : myItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Items Added Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Add food items to monitor their expiry status
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Food Item</TableHead>
                          <TableHead>Quantity Available</TableHead>
                          <TableHead>Time Until Expiry</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Auto Transfer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myItems.map((item) => {
                          const now = new Date();
                          const expiryTime = new Date(item.availableUntil);
                          const timeDiff = expiryTime.getTime() - now.getTime();
                          const isExpired = timeDiff <= 0;
                          const isExpiringSoon = timeDiff > 0 && timeDiff <= 2 * 60 * 60 * 1000; // 2 hours
                          const isExpiringCritical = timeDiff > 0 && timeDiff <= 30 * 60 * 1000; // 30 minutes
                          const isExpiringWarning = timeDiff > 30 * 60 * 1000 && timeDiff <= 60 * 60 * 1000; // 1 hour
                          
                          // Determine status and variant based on actual item status
                          let status = item.isActive ? "Active" : "Inactive";
                          let statusVariant: "default" | "secondary" | "destructive" | "outline" = item.isActive ? "default" : "secondary";
                          let statusColor = "text-green-600";
                          
                          if (isExpired) {
                            status = item.isActive ? "Active" : "Inactive";
                            statusVariant = item.isActive ? "default" : "secondary";
                            statusColor = item.isActive ? "text-green-600" : "text-gray-600";
                          } else if (isExpiringCritical) {
                            status = "Critical - 30min";
                            statusVariant = "destructive";
                            statusColor = "text-red-600";
                          } else if (isExpiringWarning) {
                            status = "Warning - 1hr";
                            statusVariant = "secondary";
                            statusColor = "text-yellow-600";
                          } else if (isExpiringSoon) {
                            status = "Expiring Soon";
                            statusVariant = "secondary";
                            statusColor = "text-yellow-600";
                          }
                          
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center">
                                    {item.imageUrl ? (
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="w-full h-full object-cover rounded-lg"
                                      />
                                    ) : (
                                      <Utensils className="w-6 h-6 text-gray-400" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                      {item.name}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {item.canteenName}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-gray-900 dark:text-white font-medium">
                                    {item.quantityAvailable}
                                  </span>
                                  {item.quantityAvailable === 0 && (
                                    <span className="text-xs text-green-600">All claimed</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`font-medium ${statusColor}`}>
                                  {formatTimeRemaining(item.availableUntil.toString())}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusVariant}>
                                  {status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {isExpired ? (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="text-red-600 border-red-600">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        Auto-transferred
                                      </Badge>
                                    </div>
                                  ) : isExpiringCritical ? (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="text-red-600 border-red-600">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        Transfer in {Math.ceil(timeDiff / (60 * 1000))}min
                                      </Badge>
                                    </div>
                                  ) : isExpiringWarning ? (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Transfer in {Math.ceil(timeDiff / (60 * 1000))}min
                                      </Badge>
                                      <span className="text-xs text-yellow-600">Monitor closely</span>
                                    </div>
                                  ) : isExpiringSoon ? (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Transfer in {Math.ceil(timeDiff / (60 * 60 * 1000))}hr
                                      </Badge>
                                      <span className="text-xs text-yellow-600">Prepare for transfer</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Auto-transfer enabled
                                      </Badge>
                                      <span className="text-xs text-blue-600">System monitored</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <EventCalendar />
          </TabsContent>
        </Tabs>
      </div>

      <Footer />

      {/* NGO Reservation Modal */}
      <Dialog open={ngoModalOpen} onOpenChange={setNgoModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Reserve for NGO Collection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDonation && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-medium">{selectedDonation.foodItem?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Quantity: {selectedDonation.quantityDonated} items
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="ngoName">NGO Name</Label>
                <Input
                  id="ngoName"
                  placeholder="Enter NGO name"
                  value={ngoForm.ngoName}
                  onChange={(e) => setNgoForm(prev => ({ ...prev, ngoName: e.target.value }))}
                  data-testid="input-ngo-name"
                />
              </div>
              
              <div>
                <Label htmlFor="ngoContactPerson">Contact Person</Label>
                <Input
                  id="ngoContactPerson"
                  placeholder="Enter contact person name"
                  value={ngoForm.ngoContactPerson}
                  onChange={(e) => setNgoForm(prev => ({ ...prev, ngoContactPerson: e.target.value }))}
                  data-testid="input-ngo-contact"
                />
              </div>
              
              <div>
                <Label htmlFor="ngoPhoneNumber">Phone Number</Label>
                <Input
                  id="ngoPhoneNumber"
                  placeholder="Enter phone number"
                  value={ngoForm.ngoPhoneNumber}
                  onChange={(e) => setNgoForm(prev => ({ ...prev, ngoPhoneNumber: e.target.value }))}
                  data-testid="input-ngo-phone"
                />
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setNgoModalOpen(false);
                  setSelectedDonation(null);
                  setNgoForm({ ngoName: "", ngoContactPerson: "", ngoPhoneNumber: "" });
                }}
                className="flex-1"
                data-testid="button-cancel-ngo"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedDonation) {
                    reserveDonationMutation.mutate({
                      id: selectedDonation.id,
                      ngoInfo: ngoForm,
                    });
                  }
                }}
                disabled={!ngoForm.ngoName || !ngoForm.ngoContactPerson || !ngoForm.ngoPhoneNumber || reserveDonationMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-confirm-ngo"
              >
                {reserveDonationMutation.isPending ? "Reserving..." : "Reserve for NGO"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MealCard } from "@/components/meal-card";
import { ClaimCodeModal } from "@/components/claim-code-modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { FoodItemWithCreator, FoodClaimWithDetails } from "@shared/schema";
import { QrCode, Clock, CheckCircle, X } from "lucide-react";
import { formatTimeRemaining } from "@/lib/qr-utils";

export default function StudentDashboard() {
  const { user, isLoading: authLoading, refetch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [claimCodeModalOpen, setClaimCodeModalOpen] = useState(false);
  const [claimedMeal, setClaimedMeal] = useState<(FoodClaimWithDetails & { foodItem: any }) | null>(null);
  const [canteenFilter, setCanteenFilter] = useState("all");

  // Try to refetch auth data if not authenticated and not loading
  React.useEffect(() => {
    console.log('StudentDashboard - Auth state:', { authLoading, user });
    
    if (!authLoading && !user) {
      console.log('StudentDashboard - No user found, trying to refetch...');
      // Try to refetch authentication data
      refetch();
      
      // If still not authenticated after a delay, redirect to login
      const timer = setTimeout(() => {
        console.log('StudentDashboard - Still no user after delay, redirecting to login');
        window.location.href = "/login";
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [authLoading, user, refetch]);

  // Show loading while checking authentication
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { data: foodItems = [], isLoading: itemsLoading } = useQuery<FoodItemWithCreator[]>({
    queryKey: ["/api/food-items"],
    enabled: !!user,
  });

  const { data: myClaims = [], isLoading: claimsLoading } = useQuery<FoodClaimWithDetails[]>({
    queryKey: ["/api/food-claims/my"],
    enabled: !!user,
  });

  const claimMutation = useMutation({
    mutationFn: async (foodItemId: string) => {
      const response = await apiRequest("POST", "/api/food-claims", {
        foodItemId,
        quantityClaimed: 1,
      });
      return response.json();
    },
    onSuccess: (newClaim) => {
      toast({
        title: "Meal Claimed Successfully!",
        description: "Your claim code is ready. Show it to canteen staff to collect your meal.",
      });
      
      // Find the food item details
      const foodItem = foodItems.find(item => item.id === newClaim.foodItemId);
      setClaimedMeal({ ...newClaim, foodItem });
      setClaimCodeModalOpen(true);
      
      // Invalidate and refetch data
      queryClient.invalidateQueries({ queryKey: ["/api/food-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food-claims/my"] });
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
      
      let description = error.message || "Something went wrong. Please try again.";
      if (error.message?.includes("already claimed")) {
        description = "You have already claimed this food item. You can only claim each item once.";
      }
      
      toast({
        title: "Failed to Claim Meal",
        description,
        variant: "destructive",
      });
    },
  });

  const handleClaimMeal = (foodItemId: string) => {
    if (claimMutation.isPending) return;
    setSelectedMeal(foodItemId);
    claimMutation.mutate(foodItemId);
  };

  // Filter food items (remove expired items and apply filters)
  const filteredItems = foodItems.filter(item => {
    // Remove expired items
    const now = new Date();
    const availableUntil = new Date(item.availableUntil);
    if (availableUntil <= now) {
      return false;
    }
    
    // Apply canteen filter
    if (canteenFilter !== "all" && item.canteenName !== canteenFilter) {
      return false;
    }
    
    // Only show items with available quantity (already calculated by backend)
    if (item.quantityAvailable <= 0) {
      return false;
    }
    
    return true;
  });

  // Get unique canteens for filter
  const canteens = Array.from(new Set(foodItems.map(item => item.canteenName)));

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
        <div className="mb-8">
          
        </div>

        <Tabs defaultValue="browse" className="space-y-6">
          <div className="flex flex-row items-center justify-between gap-2 sm:gap-4">
            <TabsList className="grid grid-cols-2 flex-1 sm:w-auto sm:max-w-md p-1 rounded-xl bg-transparent">
              <TabsTrigger value="browse" className="text-xs sm:text-sm md:text-base px-4 py-2 rounded-lg data-[state=active]:bg-forest data-[state=active]:text-white dark:data-[state=active]:bg-forest data-[state=active]:ring-1 data-[state=active]:ring-forest">Browse Meals</TabsTrigger>
              <TabsTrigger value="claims" className="text-xs sm:text-sm md:text-base px-4 py-2 rounded-lg data-[state=active]:bg-forest data-[state=active]:text-white dark:data-[state=active]:bg-forest data-[state=active]:ring-1 data-[state=active]:ring-forest">My Claims</TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 sm:gap-4">
              <Select value={canteenFilter} onValueChange={setCanteenFilter}>
                <SelectTrigger className="flex-1 sm:w-48 text-xs sm:text-sm md:text-base">
                  <SelectValue placeholder="Canteens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Canteens</SelectItem>
                  {canteens.map(canteen => (
                    <SelectItem key={canteen} value={canteen}>
                      {canteen}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="browse" className="space-y-6">
            {/* Meal Cards Grid */}
            {itemsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-1/2"></div>
                      <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <QrCode className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No meals available
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Check back later for new meal offerings from campus canteens.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    onClaim={handleClaimMeal}
                    isLoading={claimMutation.isPending && selectedMeal === meal.id}
                    userClaims={myClaims}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="claims" className="space-y-6">
            {claimsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4"></div>
                        </div>
                        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : myClaims.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Clock className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No claims yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start browsing meals to make your first claim.
                </p>
                <Button 
                  onClick={() => (document.querySelector('[value="browse"]') as HTMLElement)?.click()}
                  className="bg-forest hover:bg-forest-dark text-white"
                >
                  Browse Meals
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myClaims.map((claim) => (
                  <Card key={claim.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                            {claim.status === "claimed" ? (
                              <CheckCircle className="w-8 h-8 text-green-600" />
                            ) : claim.status === "expired" ? (
                              <X className="w-8 h-8 text-red-600" />
                            ) : (
                              <QrCode className="w-8 h-8 text-forest" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {claim.foodItem.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {claim.foodItem.canteenName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              Claimed on {new Date(claim.createdAt || '').toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={
                              claim.status === "claimed" ? "default" :
                              claim.status === "expired" ? "destructive" :
                              "secondary"
                            }
                            className="mb-2"
                          >
                            {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                          </Badge>
                          {claim.status === "reserved" && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Expires: {formatTimeRemaining(claim.expiresAt.toString())}
                            </p>
                          )}
                          {claim.status === "claimed" && claim.claimedAt && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Collected: {new Date(claim.claimedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {claim.status === "reserved" && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setClaimedMeal(claim as any);
                              setClaimCodeModalOpen(true);
                            }}
                          >
                            <QrCode className="w-4 h-4 mr-2" />
                            View Claim Code
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ClaimCodeModal
        isOpen={claimCodeModalOpen}
        onClose={() => setClaimCodeModalOpen(false)}
        claim={claimedMeal}
      />

      <Footer />
    </div>
  );
}

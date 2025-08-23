import {
  users,
  foodItems,
  foodClaims,
  foodDonations,
  events,
  type User,
  type UpsertUser,
  type FoodItem,
  type InsertFoodItem,
  type FoodClaim,
  type InsertFoodClaim,
  type FoodDonation,
  type InsertFoodDonation,
  type Event,
  type InsertEvent,
  type FoodItemWithCreator,
  type FoodClaimWithDetails,
  type FoodDonationWithDetails,
  type EventWithCreator,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Food item operations
  getAllActiveFoodItems(): Promise<FoodItemWithCreator[]>;
  getFoodItemById(id: string): Promise<FoodItem | undefined>;
  createFoodItem(foodItem: InsertFoodItem): Promise<FoodItem>;
  updateFoodItem(
    id: string,
    updates: Partial<InsertFoodItem>,
  ): Promise<FoodItem>;
  deleteFoodItem(id: string): Promise<void>;
  getFoodItemsByCreator(creatorId: string): Promise<FoodItem[]>;

  // Food claim operations
  createFoodClaim(
    claim: InsertFoodClaim & { claimCode: string },
  ): Promise<FoodClaim>;
  getFoodClaimsByUser(userId: string): Promise<FoodClaimWithDetails[]>;
  getFoodClaimByClaimCode(
    claimCode: string,
  ): Promise<FoodClaimWithDetails | undefined>;
  updateFoodClaimStatus(
    id: string,
    status: string,
    claimedAt?: Date,
  ): Promise<FoodClaim>;
  getActiveFoodClaims(): Promise<FoodClaimWithDetails[]>;

  // Get claim with full details for verification
  getClaimByCode(claimCode: string): Promise<FoodClaimWithDetails | undefined>;

  // Complete a claim (mark as collected)
  completeClaim(claimId: string): Promise<FoodClaimWithDetails>;

  // Check if user has already claimed a specific food item
  hasUserClaimedFoodItem(userId: string, foodItemId: string): Promise<boolean>;

  // Food donation operations
  getExpiredFoodItems(): Promise<FoodItem[]>;
  createFoodDonation(donation: InsertFoodDonation): Promise<FoodDonation>;
  getAllDonations(): Promise<FoodDonationWithDetails[]>;
  getDonationsByCreator(creatorId: string): Promise<FoodDonationWithDetails[]>;
  updateDonationStatus(
    id: string,
    status: string,
    ngoInfo?: {
      ngoName: string;
      ngoContactPerson: string;
      ngoPhoneNumber: string;
    },
  ): Promise<FoodDonation>;
  transferExpiredItemsToDonations(): Promise<number>;

  // Status management
  updateExpiredItemsStatus(): Promise<number>;

  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getAllEvents(): Promise<EventWithCreator[]>;
  getEventsByCreator(creatorId: string): Promise<Event[]>;
  getEventById(id: string): Promise<Event | undefined>;
  updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;

  // Stats operations
  getCampusStats(): Promise<{
    totalMealsSaved: number;
    activeStudents: number;
    partnerCanteens: number;
    totalSavings: number;
    foodProvided: number;
    wastedFood: number;
    claimedFood: number;
    carbonFootprintSaved: number;
    waterFootprintSaved: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Food item operations
  async getAllActiveFoodItems(): Promise<FoodItemWithCreator[]> {
    const now = new Date().toISOString();

    // First, automatically deactivate expired items
    await this.updateExpiredItemsStatus();

    const items = await db
      .select({
        id: foodItems.id,
        name: foodItems.name,
        description: foodItems.description,
        canteenName: foodItems.canteenName,
        canteenLocation: foodItems.canteenLocation,
        quantityAvailable: foodItems.quantityAvailable,
        imageUrl: foodItems.imageUrl,
        availableUntil: foodItems.availableUntil,
        isActive: foodItems.isActive,
        createdBy: foodItems.createdBy,
        createdAt: foodItems.createdAt,
        updatedAt: foodItems.updatedAt,
        createdByUser: users,
        claimCount: sql<number>`(SELECT COUNT(*) FROM ${foodClaims} WHERE ${foodClaims.foodItemId} = ${foodItems.id} AND ${foodClaims.status} IN ('reserved', 'claimed'))`,
      })
      .from(foodItems)
      .leftJoin(users, eq(foodItems.createdBy, users.id))
      .where(
        and(
          eq(foodItems.isActive, true),
          gte(foodItems.availableUntil, now),
          gte(foodItems.quantityAvailable, 1),
        ),
      )
      .orderBy(desc(foodItems.createdAt));

    return items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      canteenName: item.canteenName,
      canteenLocation: item.canteenLocation,
      quantityAvailable: item.quantityAvailable,
      imageUrl: item.imageUrl,
      availableUntil: item.availableUntil,
      isActive: item.isActive,
      createdBy: item.createdByUser || { id: '', email: '', firstName: '', lastName: '', profileImageUrl: '', role: 'admin', studentId: '', phoneNumber: '', createdAt: null, updatedAt: null },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      claimCount: Number(item.claimCount),
    })) as FoodItemWithCreator[];
  }

  async getFoodItemById(id: string): Promise<FoodItem | undefined> {
    const [item] = await db
      .select()
      .from(foodItems)
      .where(eq(foodItems.id, id));
    return item;
  }

  async createFoodItem(foodItem: InsertFoodItem): Promise<FoodItem> {
    const [item] = await db.insert(foodItems).values(foodItem).returning();
    return item;
  }

  async updateFoodItem(
    id: string,
    updates: Partial<InsertFoodItem>,
  ): Promise<FoodItem> {
    const [item] = await db
      .update(foodItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(foodItems.id, id))
      .returning();
    return item;
  }

  async deleteFoodItem(id: string): Promise<void> {
    // Delete associated food donations first (if any)
    await db.delete(foodDonations).where(eq(foodDonations.foodItemId, id));

    // Delete associated food claims
    await db.delete(foodClaims).where(eq(foodClaims.foodItemId, id));

    // Finally delete the food item
    await db.delete(foodItems).where(eq(foodItems.id, id));
  }

  async getFoodItemsByCreator(creatorId: string): Promise<FoodItem[]> {
    // Update expired items status before fetching
    await this.updateExpiredItemsStatus();

    return await db
      .select()
      .from(foodItems)
      .where(eq(foodItems.createdBy, creatorId))
      .orderBy(desc(foodItems.createdAt));
  }

  // Food claim operations
  async createFoodClaim(
    claim: InsertFoodClaim & { claimCode: string },
  ): Promise<FoodClaim> {
    const [newClaim] = await db.insert(foodClaims).values(claim).returning();

    // Update food item quantity
    await db
      .update(foodItems)
      .set({
        quantityAvailable: sql`quantity_available - ${claim.quantityClaimed}`,
        updatedAt: new Date(),
      })
      .where(eq(foodItems.id, claim.foodItemId));

    return newClaim;
  }

  async getFoodClaimsByUser(userId: string): Promise<FoodClaimWithDetails[]> {
    return (await db
      .select({
        id: foodClaims.id,
        userId: foodClaims.userId,
        foodItemId: foodClaims.foodItemId,
        quantityClaimed: foodClaims.quantityClaimed,
        claimCode: foodClaims.claimCode,
        status: foodClaims.status,
        expiresAt: foodClaims.expiresAt,
        claimedAt: foodClaims.claimedAt,
        createdAt: foodClaims.createdAt,
        user: users,
        foodItem: foodItems,
      })
      .from(foodClaims)
      .leftJoin(users, eq(foodClaims.userId, users.id))
      .leftJoin(foodItems, eq(foodClaims.foodItemId, foodItems.id))
      .where(eq(foodClaims.userId, userId))
      .orderBy(desc(foodClaims.createdAt))) as any;
  }

  async getFoodClaimByClaimCode(
    claimCode: string,
  ): Promise<FoodClaimWithDetails | undefined> {
    const [claim] = (await db
      .select({
        id: foodClaims.id,
        userId: foodClaims.userId,
        foodItemId: foodClaims.foodItemId,
        quantityClaimed: foodClaims.quantityClaimed,
        claimCode: foodClaims.claimCode,
        status: foodClaims.status,
        expiresAt: foodClaims.expiresAt,
        claimedAt: foodClaims.claimedAt,
        createdAt: foodClaims.createdAt,
        user: users,
        foodItem: foodItems,
      })
      .from(foodClaims)
      .leftJoin(users, eq(foodClaims.userId, users.id))
      .leftJoin(foodItems, eq(foodClaims.foodItemId, foodItems.id))
      .where(eq(foodClaims.claimCode, claimCode))) as any;

    return claim;
  }

  async updateFoodClaimStatus(
    id: string,
    status: string,
    claimedAt?: Date,
  ): Promise<FoodClaim> {
    const [claim] = await db
      .update(foodClaims)
      .set({ status, claimedAt })
      .where(eq(foodClaims.id, id))
      .returning();
    return claim;
  }

  async getActiveFoodClaims(): Promise<FoodClaimWithDetails[]> {
    const now = new Date();
    return (await db
      .select({
        id: foodClaims.id,
        userId: foodClaims.userId,
        foodItemId: foodClaims.foodItemId,
        quantityClaimed: foodClaims.quantityClaimed,
        claimCode: foodClaims.claimCode,
        status: foodClaims.status,
        expiresAt: foodClaims.expiresAt,
        claimedAt: foodClaims.claimedAt,
        createdAt: foodClaims.createdAt,
        user: users,
        foodItem: foodItems,
      })
      .from(foodClaims)
      .leftJoin(users, eq(foodClaims.userId, users.id))
      .leftJoin(foodItems, eq(foodClaims.foodItemId, foodItems.id))
      .where(
        and(eq(foodClaims.status, "reserved"), gte(foodClaims.expiresAt, now)),
      )
      .orderBy(desc(foodClaims.createdAt))) as any;
  }

  async getCampusStats(): Promise<{
    totalMealsSaved: number;
    activeStudents: number;
    partnerCanteens: number;
    totalSavings: number;
    foodProvided: number;
    wastedFood: number;
    claimedFood: number;
    carbonFootprintSaved: number;
    waterFootprintSaved: number;
  }> {
    // Get total meals claimed
    const [mealsSaved] = await db
      .select({ count: sql<number>`count(*)` })
      .from(foodClaims)
      .where(eq(foodClaims.status, "claimed"));

    // Get active students (users with claims in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [activeStudents] = await db
      .select({ count: sql<number>`count(distinct user_id)` })
      .from(foodClaims)
      .where(gte(foodClaims.createdAt, thirtyDaysAgo));

    // Get unique canteens count
    const [partnerCanteens] = await db
      .select({ count: sql<number>`count(distinct canteen_name)` })
      .from(foodItems)
      .where(eq(foodItems.isActive, true));

    // Get total food provided (sum of all food items ever created)
    const [foodProvided] = await db
      .select({ totalQuantity: sql<number>`sum(quantity_available)` })
      .from(foodItems);

    // Get wasted food (expired or expired claims)
    const now = new Date();
    const [expiredClaims] = await db
      .select({ count: sql<number>`count(*)` })
      .from(foodClaims)
      .where(sql`status = 'expired' OR (status = 'reserved' AND expires_at < ${now.toISOString()})`);

    const [expiredItems] = await db
      .select({ totalQuantity: sql<number>`sum(quantity_available)` })
      .from(foodItems)
      .where(sql`available_until < ${now.toISOString()} AND is_active = false`);

    // Get claimed food (successfully claimed meals)
    const [claimedFood] = await db
      .select({ count: sql<number>`count(*)` })
      .from(foodClaims)
      .where(eq(foodClaims.status, "claimed"));

    // Calculate environmental impact
    // Average meal: 1.5 kg CO2, 500 liters water
    const totalMeals = mealsSaved?.count || 0;
    const carbonFootprintSaved = totalMeals * 1.5; // kg CO2 saved
    const waterFootprintSaved = totalMeals * 500; // liters saved

    return {
      totalMealsSaved: totalMeals,
      activeStudents: activeStudents?.count || 0,
      partnerCanteens: partnerCanteens?.count || 0,
      totalSavings: 0,
      foodProvided: foodProvided?.totalQuantity || 0,
      wastedFood: (expiredClaims?.count || 0) + (expiredItems?.totalQuantity || 0),
      claimedFood: claimedFood?.count || 0,
      carbonFootprintSaved,
      waterFootprintSaved,
    };
  }

  // Get claim with full details for verification (alias for getFoodClaimByClaimCode)
  async getClaimByCode(
    claimCode: string,
  ): Promise<FoodClaimWithDetails | undefined> {
    return this.getFoodClaimByClaimCode(claimCode);
  }

  // Complete a claim (mark as collected)
  async completeClaim(claimId: string): Promise<FoodClaimWithDetails> {
    // Update the claim status to 'claimed'
    await this.updateFoodClaimStatus(claimId, "claimed", new Date());

    // Return the updated claim with full details
    const claim = await db
      .select({
        id: foodClaims.id,
        userId: foodClaims.userId,
        foodItemId: foodClaims.foodItemId,
        quantityClaimed: foodClaims.quantityClaimed,
        claimCode: foodClaims.claimCode,
        status: foodClaims.status,
        expiresAt: foodClaims.expiresAt,
        claimedAt: foodClaims.claimedAt,
        createdAt: foodClaims.createdAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          studentId: users.studentId,
          phoneNumber: users.phoneNumber,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        foodItem: {
          id: foodItems.id,
          name: foodItems.name,
          description: foodItems.description,
          canteenName: foodItems.canteenName,
          canteenLocation: foodItems.canteenLocation,
          quantityAvailable: foodItems.quantityAvailable,
          imageUrl: foodItems.imageUrl,
          availableUntil: foodItems.availableUntil,
          isActive: foodItems.isActive,
          createdBy: foodItems.createdBy,
          createdAt: foodItems.createdAt,
          updatedAt: foodItems.updatedAt,
        },
      })
      .from(foodClaims)
      .leftJoin(users, eq(foodClaims.userId, users.id))
      .leftJoin(foodItems, eq(foodClaims.foodItemId, foodItems.id))
      .where(eq(foodClaims.id, claimId))
      .limit(1);

    if (!claim[0]) {
      throw new Error("Claim not found after completion");
    }

    return claim[0] as FoodClaimWithDetails;
  }

  // Check if user has already claimed a specific food item
  async hasUserClaimedFoodItem(userId: string, foodItemId: string): Promise<boolean> {
    const existingClaim = await db
      .select({ id: foodClaims.id })
      .from(foodClaims)
      .where(
        and(
          eq(foodClaims.userId, userId),
          eq(foodClaims.foodItemId, foodItemId),
          sql`${foodClaims.status} IN ('reserved', 'claimed')`
        )
      )
      .limit(1);
    
    return existingClaim.length > 0;
  }

  // Food donation operations
  async getExpiredFoodItems(): Promise<FoodItem[]> {
    const now = new Date().toISOString();
    return await db
      .select()
      .from(foodItems)
      .where(
        and(
          eq(foodItems.isActive, false), // Now get inactive items (which are expired)
          sql`${foodItems.availableUntil} < ${now}`,
        ),
      )
      .orderBy(desc(foodItems.createdAt));
  }

  // New method to automatically update expired items to inactive
  async updateExpiredItemsStatus(): Promise<number> {
    const now = new Date().toISOString();

    // Set expired items to inactive
    const expiredResult = await db
      .update(foodItems)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(foodItems.isActive, true),
          sql`${foodItems.availableUntil} < ${now}`,
        ),
      )
      .returning({ id: foodItems.id });

    // Reactivate items that are not expired anymore (in case time was extended)
    const reactivatedResult = await db
      .update(foodItems)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(foodItems.isActive, false),
          gte(foodItems.availableUntil, now),
          gte(foodItems.quantityAvailable, 1),
        ),
      )
      .returning({ id: foodItems.id });

    return expiredResult.length;
  }

  async createFoodDonation(
    donation: InsertFoodDonation,
  ): Promise<FoodDonation> {
    const [newDonation] = await db
      .insert(foodDonations)
      .values(donation)
      .returning();
    return newDonation;
  }

  async getAllDonations(): Promise<FoodDonationWithDetails[]> {
    return (await db
      .select({
        id: foodDonations.id,
        foodItemId: foodDonations.foodItemId,
        ngoName: foodDonations.ngoName,
        ngoContactPerson: foodDonations.ngoContactPerson,
        ngoPhoneNumber: foodDonations.ngoPhoneNumber,
        quantityDonated: foodDonations.quantityDonated,
        status: foodDonations.status,
        donatedAt: foodDonations.donatedAt,
        reservedAt: foodDonations.reservedAt,
        collectedAt: foodDonations.collectedAt,
        notes: foodDonations.notes,
        createdAt: foodDonations.createdAt,
        foodItem: foodItems,
      })
      .from(foodDonations)
      .leftJoin(foodItems, eq(foodDonations.foodItemId, foodItems.id))
      .orderBy(desc(foodDonations.createdAt))) as any;
  }

  async getDonationsByCreator(
    creatorId: string,
  ): Promise<FoodDonationWithDetails[]> {
    return (await db
      .select({
        id: foodDonations.id,
        foodItemId: foodDonations.foodItemId,
        ngoName: foodDonations.ngoName,
        ngoContactPerson: foodDonations.ngoContactPerson,
        ngoPhoneNumber: foodDonations.ngoPhoneNumber,
        quantityDonated: foodDonations.quantityDonated,
        status: foodDonations.status,
        donatedAt: foodDonations.donatedAt,
        reservedAt: foodDonations.reservedAt,
        collectedAt: foodDonations.collectedAt,
        notes: foodDonations.notes,
        createdAt: foodDonations.createdAt,
        foodItem: foodItems,
      })
      .from(foodDonations)
      .leftJoin(foodItems, eq(foodDonations.foodItemId, foodItems.id))
      .where(eq(foodItems.createdBy, creatorId))
      .orderBy(desc(foodDonations.createdAt))) as any;
  }

  async updateDonationStatus(
    id: string,
    status: string,
    ngoInfo?: {
      ngoName: string;
      ngoContactPerson: string;
      ngoPhoneNumber: string;
    },
  ): Promise<FoodDonation> {
    const updateData: any = { status };

    if (status === "reserved_for_ngo" && ngoInfo) {
      updateData.ngoName = ngoInfo.ngoName;
      updateData.ngoContactPerson = ngoInfo.ngoContactPerson;
      updateData.ngoPhoneNumber = ngoInfo.ngoPhoneNumber;
      updateData.reservedAt = new Date();
    } else if (status === "collected") {
      updateData.collectedAt = new Date();
    }

    const [donation] = await db
      .update(foodDonations)
      .set(updateData)
      .where(eq(foodDonations.id, id))
      .returning();
    return donation;
  }

  async transferExpiredItemsToDonations(): Promise<number> {
    // First update expired items status
    await this.updateExpiredItemsStatus();

    const expiredItems = await this.getExpiredFoodItems();
    let transferredCount = 0;

    for (const item of expiredItems) {
      if (item.quantityAvailable > 0) {
        // Check if donation already exists for this item
        const existingDonation = await db
          .select()
          .from(foodDonations)
          .where(eq(foodDonations.foodItemId, item.id))
          .limit(1);

        if (existingDonation.length === 0) {
          // Create donation entry only if it doesn't exist
          await this.createFoodDonation({
            foodItemId: item.id,
            quantityDonated: item.quantityAvailable,
            status: "available",
            notes: `Auto-transferred from expired food item: ${item.name}`,
          });
          transferredCount++;
        }
      }
    }

    return transferredCount;
  }

  // Event operations
  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getAllEvents(): Promise<EventWithCreator[]> {
    return (await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        startTime: events.startTime,
        endTime: events.endTime,
        location: events.location,
        phoneNumber: events.phoneNumber,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        createdByUser: users,
      })
      .from(events)
      .leftJoin(users, eq(events.createdBy, users.id))
      .orderBy(desc(events.startTime))) as any;
  }

  async getEventsByCreator(creatorId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.createdBy, creatorId))
      .orderBy(desc(events.startTime));
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id));
    return event;
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event> {
    const [event] = await db
      .update(events)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }
}

export const storage = new DatabaseStorage();

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

import { insertFoodItemSchema, insertFoodClaimSchema, insertEventSchema } from "@shared/schema";
import { generateClaimCode } from "@shared/qr-utils";
import { z } from "zod";
import 'express-session';

// Extend session interface for demo auth
declare module 'express-session' {
  interface SessionData {
    user?: {
      claims: { sub: string };
      access_token: string;
      expires_at: number;
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  

  // Development authentication bypass for demo purposes
  app.get('/api/demo-login/:role', async (req, res) => {
    try {
      const { role } = req.params;
      
      if (role !== 'student' && role !== 'admin') {
        return res.status(400).json({ message: "Invalid role. Use 'student' or 'admin'" });
      }

      // Create or get existing demo user
      const demoUser = await storage.upsertUser({
        id: `demo-${role}-main`,
        email: `${role}-main@demo.edu`,
        firstName: role === 'admin' ? 'Demo' : 'Student',
        lastName: role === 'admin' ? 'Admin' : 'Demo',
        role: role,
        studentId: role === 'student' ? 'STU123456' : undefined,
        phoneNumber: '+1234567890',
      });

      // Create demo session
      req.session.user = {
        claims: { sub: demoUser.id },
        access_token: 'demo-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      };

      res.json({ success: true, user: demoUser });
    } catch (error) {
      console.error("Error creating demo user:", error);
      res.status(500).json({ message: "Failed to create demo user" });
    }
  });

  // Demo data seeding
  app.post('/api/seed-demo-data', async (req, res) => {
    try {
      // Use the main demo admin user (same as login)
      const adminUser = await storage.upsertUser({
        id: 'demo-admin-main',
        email: `admin-main@demo.edu`,
        firstName: 'Demo',
        lastName: 'Admin',
        role: 'admin',
        phoneNumber: '+1234567890',
      });

      // Check if demo data already exists for this user
      const existingItems = await storage.getFoodItemsByCreator(adminUser.id);
      if (existingItems.length > 0) {
        return res.json({ success: true, message: 'Demo data already exists' });
      }

      // Create some demo food items
      const now = new Date();
      const availableUntil = new Date();
      availableUntil.setHours(availableUntil.getHours() + 6); // Available for 6 hours

      const demoFoodItems = [
        {
          name: 'Margherita Pizza',
          description: 'Fresh mozzarella, basil, and tomato sauce on a crispy crust',
          canteenName: 'Main Campus Cafeteria',
          canteenLocation: 'Building A, Ground Floor',
          quantityAvailable: 3,
          imageUrl: null,
          availableUntil: availableUntil.toISOString(),
          isActive: true,
          createdBy: adminUser.id,
        },
        {
          name: 'Chicken Caesar Salad',
          description: 'Grilled chicken breast with romaine lettuce, parmesan, and caesar dressing',
          canteenName: 'Student Union Food Court',
          canteenLocation: 'Building B, 2nd Floor',
          quantityAvailable: 5,
          imageUrl: null,
          availableUntil: availableUntil.toISOString(),
          isActive: true,
          createdBy: adminUser.id,
        },
        {
          name: 'Vegetarian Wrap',
          description: 'Mixed vegetables, hummus, and fresh herbs in a whole wheat wrap',
          canteenName: 'Green Campus Cafe',
          canteenLocation: 'Library Building, 1st Floor',
          quantityAvailable: 4,
          imageUrl: null,
          availableUntil: availableUntil.toISOString(),
          isActive: true,
          createdBy: adminUser.id,
        }
      ];

      for (const item of demoFoodItems) {
        await storage.createFoodItem(item);
      }

      res.json({ success: true, message: 'Demo data seeded successfully' });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ message: "Failed to seed demo data" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      let user = null;
      
      // Check for demo session first
      if (req.session.user) {
        const userId = req.session.user.claims.sub;
        user = await storage.getUser(userId);
      }
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      return res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout route
  app.post('/api/auth/logout', (req: any, res) => {
    // Destroy the session
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Error logging out" });
      }
      // Clear the session cookie
      res.clearCookie('connect.sid', { path: '/' });
      return res.json({ success: true });
    });
  });

  // Food items routes
  app.get('/api/food-items', async (req, res) => {
    try {
      const items = await storage.getAllActiveFoodItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching food items:", error);
      res.status(500).json({ message: "Failed to fetch food items" });
    }
  });

  app.get('/api/food-items/my', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const items = await storage.getFoodItemsByCreator(userId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching user's food items:", error);
      res.status(500).json({ message: "Failed to fetch food items" });
    }
  });

  app.post('/api/food-items', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can create food items" });
      }

      const validatedData = insertFoodItemSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const item = await storage.createFoodItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating food item:", error);
      res.status(500).json({ message: "Failed to create food item" });
    }
  });

  app.put('/api/food-items/:id', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can update food items" });
      }

      const { id } = req.params;
      const existingItem = await storage.getFoodItemById(id);
      
      if (!existingItem || existingItem.createdBy !== userId) {
        return res.status(404).json({ message: "Food item not found or unauthorized" });
      }

      const validatedData = insertFoodItemSchema.partial().parse(req.body);
      const updatedItem = await storage.updateFoodItem(id, validatedData);
      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating food item:", error);
      res.status(500).json({ message: "Failed to update food item" });
    }
  });

  app.delete('/api/food-items/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const existingItem = await storage.getFoodItemById(id);
      
      if (!existingItem) {
        return res.status(404).json({ message: "Food item not found" });
      }

      await storage.deleteFoodItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting food item:", error);
      res.status(500).json({ message: "Failed to delete food item" });
    }
  });

  // Food claims routes
  app.post('/api/food-claims', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { foodItemId, quantityClaimed = 1 } = req.body;

      // Validate food item exists and has availability
      const foodItem = await storage.getFoodItemById(foodItemId);
      if (!foodItem || !foodItem.isActive) {
        return res.status(404).json({ message: "Food item not found or inactive" });
      }

      if (foodItem.quantityAvailable < quantityClaimed) {
        return res.status(400).json({ message: "Insufficient quantity available" });
      }

      if (new Date() >= new Date(foodItem.availableUntil)) {
        return res.status(400).json({ message: "Food item is no longer available" });
      }

      // Check if user has already claimed this food item
      const hasAlreadyClaimed = await storage.hasUserClaimedFoodItem(userId, foodItemId);
      if (hasAlreadyClaimed) {
        return res.status(400).json({ message: "You have already claimed this food item" });
      }

      // Generate claim code
      const claimCode = generateClaimCode();
      
      // Set expiration (20 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 20);

      const claimData = {
        userId,
        foodItemId,
        quantityClaimed,
        claimCode,
        status: "reserved" as const,
        expiresAt,
      };

      const claim = await storage.createFoodClaim(claimData);
      res.status(201).json(claim);
    } catch (error) {
      console.error("Error creating food claim:", error);
      res.status(500).json({ message: "Failed to claim food item" });
    }
  });

  app.get('/api/food-claims/my', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const claims = await storage.getFoodClaimsByUser(userId);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching user's claims:", error);
      res.status(500).json({ message: "Failed to fetch claims" });
    }
  });

  app.get('/api/food-claims/code/:claimCode', async (req, res) => {
    try {
      const { claimCode } = req.params;
      const claim = await storage.getFoodClaimByClaimCode(claimCode);
      
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      // Check if claim is expired
      if (new Date() > new Date(claim.expiresAt)) {
        await storage.updateFoodClaimStatus(claim.id, "expired");
        return res.status(400).json({ message: "Claim has expired" });
      }

      res.json(claim);
    } catch (error) {
      console.error("Error fetching claim by code:", error);
      res.status(500).json({ message: "Failed to fetch claim" });
    }
  });

  app.put('/api/food-claims/:id/claim', async (req: any, res) => {
    try {
      const { id } = req.params;
      const claim = await storage.getFoodClaimByClaimCode(id); // id is actually claimCode here
      
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      if (claim.status !== "reserved") {
        return res.status(400).json({ message: "Claim is not in reserved status" });
      }

      if (new Date() > new Date(claim.expiresAt)) {
        await storage.updateFoodClaimStatus(claim.id, "expired");
        return res.status(400).json({ message: "Claim has expired" });
      }

      const updatedClaim = await storage.updateFoodClaimStatus(claim.id, "claimed", new Date());
      res.json(updatedClaim);
    } catch (error) {
      console.error("Error claiming food:", error);
      res.status(500).json({ message: "Failed to claim food" });
    }
  });

  // Stats routes
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getCampusStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Claim verification endpoints
  app.post("/api/food-claims/verify", async (req: any, res) => {
    try {
      const { claimCode } = req.body;
      if (!claimCode) {
        return res.status(400).json({ success: false, message: "Claim code is required" });
      }

      const claim = await storage.getClaimByCode(claimCode);
      if (!claim) {
        return res.json({ success: false, message: "Invalid claim code" });
      }

      if (claim.status !== "reserved") {
        return res.json({ success: false, message: `Claim is ${claim.status}` });
      }

      if (new Date() > new Date(claim.expiresAt)) {
        return res.json({ success: false, message: "Claim has expired" });
      }

      res.json({ success: true, claim });
    } catch (error) {
      console.error("Error verifying claim:", error);
      res.status(500).json({ success: false, message: "Failed to verify claim" });
    }
  });

  app.post("/api/food-claims/:id/complete", async (req: any, res) => {
    try {
      const claimId = req.params.id;
      const updatedClaim = await storage.completeClaim(claimId);
      
      // Remove the food item from the table after successful claim completion
      if (updatedClaim.foodItem) {
        await storage.deleteFoodItem(updatedClaim.foodItem.id);
      }
      
      res.json(updatedClaim);
    } catch (error) {
      console.error("Error completing claim:", error);
      res.status(500).json({ message: "Failed to complete claim" });
    }
  });

  // Food donation routes
  app.get('/api/donations', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can view donations" });
      }

      const donations = await storage.getDonationsByCreator(userId);
      res.json(donations);
    } catch (error) {
      console.error("Error fetching donations:", error);
      res.status(500).json({ message: "Failed to fetch donations" });
    }
  });

  app.post('/api/donations/transfer-expired', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can transfer expired items" });
      }

      const transferredCount = await storage.transferExpiredItemsToDonations();
      res.json({ success: true, transferredCount });
    } catch (error) {
      console.error("Error transferring expired items:", error);
      res.status(500).json({ message: "Failed to transfer expired items" });
    }
  });

  app.put('/api/donations/:id/reserve', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can manage donations" });
      }

      const { id } = req.params;
      const { ngoName, ngoContactPerson, ngoPhoneNumber } = req.body;

      if (!ngoName || !ngoContactPerson || !ngoPhoneNumber) {
        return res.status(400).json({ message: "NGO information is required" });
      }

      const updatedDonation = await storage.updateDonationStatus(id, "reserved_for_ngo", {
        ngoName,
        ngoContactPerson,
        ngoPhoneNumber,
      });

      res.json(updatedDonation);
    } catch (error) {
      console.error("Error reserving donation:", error);
      res.status(500).json({ message: "Failed to reserve donation" });
    }
  });

  app.put('/api/donations/:id/collect', async (req: any, res) => {
    try {
      let userId = null;
      
      // Check demo session first
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can manage donations" });
      }

      const { id } = req.params;
      const updatedDonation = await storage.updateDonationStatus(id, "collected");
      res.json(updatedDonation);
    } catch (error) {
      console.error("Error marking donation as collected:", error);
      res.status(500).json({ message: "Failed to mark donation as collected" });
    }
  });

  // Events routes
  app.get('/api/events', async (req: any, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get('/api/events/my', async (req: any, res) => {
    try {
      let userId = null;
      
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can view their events" });
      }

      const events = await storage.getEventsByCreator(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching user events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post('/api/events', async (req: any, res) => {
    try {
      let userId = null;
      
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can create events" });
      }

      const validatedData = insertEventSchema.parse({
        ...req.body,
        createdBy: userId,
      });

      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid event data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.put('/api/events/:id', async (req: any, res) => {
    try {
      let userId = null;
      
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can update events" });
      }

      const { id } = req.params;
      const existingEvent = await storage.getEventById(id);
      
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (existingEvent.createdBy !== userId) {
        return res.status(403).json({ message: "You can only update your own events" });
      }

      const validatedData = insertEventSchema.partial().parse(req.body);
      const updatedEvent = await storage.updateEvent(id, validatedData);
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating event:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid event data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete('/api/events/:id', async (req: any, res) => {
    try {
      let userId = null;
      
      if (req.session.user) {
        userId = req.session.user.claims.sub;
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can delete events" });
      }

      const { id } = req.params;
      const existingEvent = await storage.getEventById(id);
      
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (existingEvent.createdBy !== userId) {
        return res.status(403).json({ message: "You can only delete your own events" });
      }

      await storage.deleteEvent(id);
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
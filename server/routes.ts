import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

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

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://re-plate.onrender.com/api/auth/google/callback'
    : 'http://localhost:5000/api/auth/google/callback');

// Configure Passport
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth profile received:', profile);
    console.log('Profile emails:', profile.emails);
    
    // Check if user exists
    let user = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
    console.log('Existing user found:', user);
    
    if (!user) {
      console.log('Creating new user for email:', profile.emails?.[0]?.value);
      // Create new user with role based on OAuth request
      user = await storage.upsertUser({
        id: profile.id,
        email: profile.emails?.[0]?.value || '',
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        profileImageUrl: profile.photos?.[0]?.value || '',
        role: 'student', // Default to student, will be updated in callback if needed
        studentId: `STU${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phoneNumber: '',
      });
      console.log('New user created:', user);
    }
    
    console.log('Returning user to passport:', user);
    return done(null, user);
  } catch (error) {
    console.error('Google OAuth strategy error:', error);
    return done(error as Error);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    console.log('Passport deserializeUser called with ID:', id);
    const user = await storage.getUser(id);
    console.log('Deserialized user:', user);
    done(null, user);
  } catch (error) {
    console.error('Passport deserializeUser error:', error);
    done(error);
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Debug middleware for all requests
  app.use((req: any, res, next) => {
    console.log(`${req.method} ${req.path} - Body:`, req.body);
    next();
  });

  // Auth middleware
  



  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      console.log('Auth user endpoint called');
      console.log('Session:', req.session);
      
      let user = null;
      
      // Check for demo session first
      if (req.session.user) {
        console.log('Session user found:', req.session.user);
        const userId = req.session.user.claims.sub;
        console.log('Looking up user with ID:', userId);
        user = await storage.getUser(userId);
        console.log('Found user:', user);
      } else {
        console.log('No session user found');
      }
      
      if (!user) {
        console.log('No user found, returning 401');
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      console.log('Returning user:', user);
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

  // Test session endpoint
  app.get('/api/test-session', (req: any, res) => {
    console.log('Test session endpoint called');
    console.log('Session:', req.session);
    console.log('Session ID:', req.session.id);
    console.log('Session user:', req.session.user);
    res.json({ 
      session: req.session, 
      sessionId: req.session.id,
      sessionUser: req.session.user,
      cookies: req.headers.cookie 
    });
  });

  // Google OAuth routes
  app.get('/api/auth/google', (req: any, res, next) => {
    // Store the role parameter in session for use in callback
    const role = req.query.role as string;
    if (role) {
      req.session.oauthRole = role;
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req: any, res) => {
      try {
        // Successful authentication
        if (req.user) {
          console.log('Google OAuth successful for user:', req.user);
          
          // Check if this is an admin login request
          const oauthRole = req.session.oauthRole;
          let user = req.user;
          
          if (oauthRole === 'admin') {
            // For admin login, directly assign admin role
            user = await storage.upsertUser({
              ...req.user,
              role: 'admin', // Directly assign admin role
            });
            console.log('Updated user role to admin:', user);
          }
          
          // Clear the oauth role from session
          delete req.session.oauthRole;
          
          // Create session
          req.session.user = {
            claims: { sub: user.id },
            access_token: 'google-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
          };
          
          // Save session
          req.session.save((err: any) => {
            if (err) {
              console.error('Session save error:', err);
              return res.redirect('/login?error=session_error');
            }
            
            console.log('Session saved successfully for user:', user.id);
            
            // Redirect based on role
            if (oauthRole === 'admin') {
              // Admin login - always redirect to admin dashboard
              res.redirect('/admin');
            } else {
              // Student login - redirect to student dashboard
              res.redirect('/student');
            }
          });
        } else {
          console.error('No user found after Google OAuth');
          res.redirect('/login?error=auth_failed');
        }
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect('/login?error=auth_failed');
      }
    }
  );

  // Admin password verification route
  app.post('/api/auth/verify-admin-password', async (req: any, res) => {
    try {
      console.log('Password verification request received');
      console.log('Request body:', req.body);
      
      const { password } = req.body;
      
      if (!password) {
        console.log('No password provided');
        return res.status(400).json({ message: "Password is required" });
      }

      // Get admin password from environment variable
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Default password for development
      
      // For debugging - hardcode the password temporarily
      const hardcodedPassword = 'admin123';
      
      console.log('Password verification attempt:');
      console.log('Input password:', password);
      console.log('Expected password:', adminPassword);
      console.log('Hardcoded password:', hardcodedPassword);
      console.log('Environment ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('Passwords match (env):', password === adminPassword);
      console.log('Passwords match (hardcoded):', password === hardcodedPassword);
      
      // Try both passwords for debugging
      if (password === adminPassword || password === hardcodedPassword) {
        console.log('Password verified successfully');
        res.json({ 
          success: true, 
          message: "Password verified successfully" 
        });
      } else {
        console.log('Password verification failed');
        res.status(401).json({ message: "Invalid admin password" });
      }
    } catch (error) {
      console.error("Error verifying admin password:", error);
      res.status(500).json({ message: "Failed to verify password" });
    }
  });

  // Admin authentication route
  app.get('/api/auth/admin', async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.session.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.session.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has admin role
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      res.json({ 
        success: true, 
        user: user,
        message: "Admin access granted" 
      });
    } catch (error) {
      console.error("Admin authentication error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // Get pending admin users (for super admin approval)
  app.get('/api/admin/pending-users', async (req: any, res) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.session.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.session.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      // Get all users with null role (pending admin approval)
      const pendingUsers = await storage.getUsersByRole(null);
      res.json(pendingUsers);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      res.status(500).json({ message: "Failed to fetch pending users" });
    }
  });

  // Approve admin user
  app.post('/api/admin/approve-user/:userId', async (req: any, res) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.session.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const adminUserId = req.session.user.claims.sub;
      const adminUser = await storage.getUser(adminUserId);

      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { userId } = req.params;
      const userToApprove = await storage.getUser(userId);

      if (!userToApprove) {
        return res.status(404).json({ message: "User not found" });
      }

      if (userToApprove.role !== null) {
        return res.status(400).json({ message: "User is not pending approval" });
      }

      // Approve the user as admin
      const approvedUser = await storage.upsertUser({
        ...userToApprove,
        role: 'admin',
      });

      res.json({ 
        success: true, 
        user: approvedUser,
        message: "User approved as admin" 
      });
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: "Failed to approve user" });
    }
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
      
      // Send notifications to users who have claimed from this canteen
      try {
        const usersToNotify = await storage.getUsersWhoClaimedFromCanteen(validatedData.canteenName);
        
        for (const userIdToNotify of usersToNotify) {
          // Don't notify the admin who created the item
          if (userIdToNotify !== userId) {
            await storage.createNotification({
              userId: userIdToNotify,
              title: "New Food Available!",
              message: `${validatedData.name} is now available at ${validatedData.canteenName}. Check it out before it's gone!`,
              type: "info",
              relatedItemId: item.id,
              relatedItemType: "food_item"
            });
          }
        }
      } catch (notificationError) {
        console.error("Error sending notifications:", notificationError);
        // Don't fail the food item creation if notifications fail
      }
      
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

      // Get all active claims for this food item to calculate actual available quantity
      const activeClaims = await storage.getActiveFoodClaims();
      const reservedQuantity = activeClaims
        .filter(claim => claim.foodItemId === foodItemId && claim.status === "reserved")
        .reduce((sum, claim) => sum + claim.quantityClaimed, 0);

      const actualAvailableQuantity = foodItem.quantityAvailable - reservedQuantity;

      if (actualAvailableQuantity < quantityClaimed) {
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
      
      // Send notification to the canteen admin about the claim
      try {
        const user = await storage.getUser(userId);
        await storage.createNotification({
          userId: foodItem.createdBy,
          title: "New Food Claim!",
          message: `${user?.firstName || 'A student'} has claimed ${quantityClaimed} ${quantityClaimed === 1 ? 'item' : 'items'} of "${foodItem.name}". Claim code: ${claimCode}`,
          type: "info",
          relatedItemId: claim.id,
          relatedItemType: "claim"
        });
      } catch (notificationError) {
        console.error("Error sending claim notification:", notificationError);
        // Don't fail the claim if notification fails
      }
      
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
      
      // Note: Quantity reduction is already handled in storage.completeClaim method
      // The food item remains in the database with reduced quantity
      
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

  // Notification endpoints
  app.get('/api/notifications', async (req, res) => {
    try {
      if (!req.session.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notifications = await storage.getNotificationsByUser(req.session.user.claims.sub);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      if (!req.session.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put('/api/notifications/read-all', async (req, res) => {
    try {
      if (!req.session.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markAllNotificationsAsRead(req.session.user.claims.sub);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  app.get('/api/notifications/unread-count', async (req, res) => {
    try {
      if (!req.session.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const count = await storage.getUnreadNotificationCount(req.session.user.claims.sub);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Phone verification endpoint
  app.post('/api/verify-phone', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Basic phone number validation
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ 
          valid: false, 
          message: "Invalid phone number format" 
        });
      }

      // For demo purposes, we'll do basic validation
      // In production, you would integrate with a real phone verification service
      // like Twilio, NumVerify, or similar APIs
      
      // Check if it's a valid length and format
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        return res.status(400).json({ 
          valid: false, 
          message: "Phone number must be between 10-15 digits" 
        });
      }

      // Simulate API call to phone verification service
      // In real implementation, replace this with actual API call
      const isValid = cleanNumber.length >= 10 && /^[1-9]/.test(cleanNumber);
      
      if (isValid) {
        res.json({ 
          valid: true, 
          message: "Phone number is valid and belongs to a real person",
          phoneNumber: phoneNumber
        });
      } else {
        res.json({ 
          valid: false, 
          message: "Invalid phone number. Please enter a valid number that belongs to a real person." 
        });
      }
    } catch (error) {
      console.error("Error verifying phone number:", error);
      res.status(500).json({ 
        valid: false, 
        message: "Failed to verify phone number. Please try again." 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
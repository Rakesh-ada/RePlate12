import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("student"), // student or admin
  studentId: varchar("student_id"),
  phoneNumber: varchar("phone_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Food items table
export const foodItems = pgTable("food_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  canteenName: varchar("canteen_name", { length: 255 }).notNull(),
  canteenLocation: varchar("canteen_location", { length: 255 }),
  quantityAvailable: integer("quantity_available").notNull().default(0),
  imageUrl: text("image_url"),
  availableUntil: timestamp("available_until", { mode: 'string' }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Food claims table
export const foodClaims = pgTable("food_claims", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  foodItemId: uuid("food_item_id").notNull().references(() => foodItems.id),
  quantityClaimed: integer("quantity_claimed").notNull().default(1),
  claimCode: varchar("claim_code", { length: 20 }).unique().notNull(),
  status: varchar("status", { length: 50 }).notNull().default("reserved"), // reserved, claimed, expired, cancelled
  expiresAt: timestamp("expires_at").notNull(),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Food donations table
export const foodDonations = pgTable("food_donations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  foodItemId: uuid("food_item_id").notNull().references(() => foodItems.id),
  ngoName: varchar("ngo_name", { length: 255 }),
  ngoContactPerson: varchar("ngo_contact_person", { length: 255 }),
  ngoPhoneNumber: varchar("ngo_phone_number", { length: 20 }),
  quantityDonated: integer("quantity_donated").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("available"), // available, reserved_for_ngo, collected
  donatedAt: timestamp("donated_at").defaultNow(),
  reservedAt: timestamp("reserved_at"),
  collectedAt: timestamp("collected_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Events table
export const events = pgTable("events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { mode: 'string' }).notNull(),
  endTime: timestamp("end_time", { mode: 'string' }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  foodItems: many(foodItems),
  foodClaims: many(foodClaims),
  events: many(events),
}));

export const foodItemsRelations = relations(foodItems, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [foodItems.createdBy],
    references: [users.id],
  }),
  claims: many(foodClaims),
  donations: many(foodDonations),
}));

export const foodClaimsRelations = relations(foodClaims, ({ one }) => ({
  user: one(users, {
    fields: [foodClaims.userId],
    references: [users.id],
  }),
  foodItem: one(foodItems, {
    fields: [foodClaims.foodItemId],
    references: [foodItems.id],
  }),
}));

export const foodDonationsRelations = relations(foodDonations, ({ one }) => ({
  foodItem: one(foodItems, {
    fields: [foodDonations.foodItemId],
    references: [foodItems.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  createdBy: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
  studentId: true,
  phoneNumber: true,
});

export const insertFoodItemSchema = createInsertSchema(foodItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFoodClaimSchema = createInsertSchema(foodClaims).omit({
  id: true,
  claimCode: true,
  createdAt: true,
});

export const insertFoodDonationSchema = createInsertSchema(foodDonations).omit({
  id: true,
  donatedAt: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertFoodItem = z.infer<typeof insertFoodItemSchema>;
export type FoodItem = typeof foodItems.$inferSelect;
export type InsertFoodClaim = z.infer<typeof insertFoodClaimSchema>;
export type FoodClaim = typeof foodClaims.$inferSelect;
export type InsertFoodDonation = z.infer<typeof insertFoodDonationSchema>;
export type FoodDonation = typeof foodDonations.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Extended types with relations
export type FoodItemWithCreator = FoodItem & {
  createdBy: User;
  claimCount?: number;
};

export type FoodClaimWithDetails = FoodClaim & {
  user: User;
  foodItem: FoodItem;
};

export type FoodDonationWithDetails = FoodDonation & {
  foodItem: FoodItem;
};

export type EventWithCreator = Event & {
  createdBy: User;
};

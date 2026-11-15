import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const PRICES = ["$", "$$", "$$$"] as const;
export type Price = (typeof PRICES)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // which family this person belongs to (see families.ts); families never see each other
    family: text("family").notNull().default("redder"),
    name: text("name").notNull(),
    // lower-cased, trimmed, single-spaced name; makes "Mom" and " mom " the same person
    nameKey: text("name_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    // salted scrypt hash of the person's 4-digit PIN; null until they set one (people who joined before PINs)
    pinHash: text("pin_hash"),
    failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
    pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
  },
  // names are unique within a family: both families can have a "Mom"
  (t) => [uniqueIndex("idx_users_family_name_key_unique").on(t.family, t.nameKey)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    // addedById = ownerId -> the owner's own wish; anything else is a secret idea hidden from the owner
    addedById: uuid("added_by_id").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    notes: text("notes"),
    price: text("price").$type<Price>(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_items_owner_active").on(t.ownerId).where(sql`${t.deletedAt} IS NULL`),
    check("items_price_check", sql`${t.price} IS NULL OR ${t.price} IN ('$', '$$', '$$$')`),
  ],
);

export type ItemSnapshot = {
  title: string;
  url: string | null;
  notes: string | null;
  price: Price | null;
};

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id").notNull(),
    claimerId: uuid("claimer_id").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    // item details as the claimer last saw them; used to tell them what the owner changed
    snapshot: jsonb("snapshot").$type<ItemSnapshot>().notNull(),
    // claimer acknowledged that the owner removed this item
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (t) => [
    // one claim per item: makes simultaneous double-claims impossible
    uniqueIndex("idx_claims_item_id_unique").on(t.itemId),
    index("idx_claims_claimer_id").on(t.claimerId),
  ],
);

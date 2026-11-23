import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Authenticated users linked via Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('donor'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Live volunteer GPS coordinates for active deliveries
export const liveLocations = pgTable('live_locations', {
  deliveryId: text('delivery_id').primaryKey(),
  volunteerId: text('volunteer_id').notNull(),
  volunteerUid: text('volunteer_uid').references(() => users.uid),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  accuracyMeters: doublePrecision('accuracy_meters'),
  speedKmh: doublePrecision('speed_kmh'),
  deliveryStatus: text('delivery_status').notNull().default('COLLECTED'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Optional timestamped breadcrumb trail for delivery audit & route review
export const locationHistory = pgTable('location_history', {
  id: serial('id').primaryKey(),
  deliveryId: text('delivery_id').notNull(),
  volunteerId: text('volunteer_id').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  liveLocations: many(liveLocations),
}));

export const liveLocationsRelations = relations(liveLocations, ({ one }) => ({
  volunteerUser: one(users, {
    fields: [liveLocations.volunteerUid],
    references: [users.uid],
  }),
}));

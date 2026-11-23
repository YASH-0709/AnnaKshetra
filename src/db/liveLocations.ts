import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { liveLocations, locationHistory } from './schema.ts';

export interface UpsertLiveLocationInput {
  deliveryId: string;
  volunteerId: string;
  volunteerUid?: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  speedKmh?: number | null;
  deliveryStatus: string;
}

export async function upsertLiveLocation(input: UpsertLiveLocationInput) {
  try {
    const now = new Date();
    const [saved] = await db
      .insert(liveLocations)
      .values({
        deliveryId: input.deliveryId,
        volunteerId: input.volunteerId,
        volunteerUid: input.volunteerUid || null,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters:
          input.accuracyMeters !== undefined ? input.accuracyMeters : null,
        speedKmh: input.speedKmh !== undefined ? input.speedKmh : null,
        deliveryStatus: input.deliveryStatus,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: liveLocations.deliveryId,
        set: {
          volunteerId: input.volunteerId,
          volunteerUid: input.volunteerUid || null,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters:
            input.accuracyMeters !== undefined ? input.accuracyMeters : null,
          speedKmh: input.speedKmh !== undefined ? input.speedKmh : null,
          deliveryStatus: input.deliveryStatus,
          updatedAt: now,
        },
      })
      .returning();

    await db.insert(locationHistory).values({
      deliveryId: input.deliveryId,
      volunteerId: input.volunteerId,
      latitude: input.latitude,
      longitude: input.longitude,
      recordedAt: now,
    });

    return saved;
  } catch (error) {
    console.error('Database query failed in upsertLiveLocation:', error);
    throw new Error('Failed to persist live location update.', {
      cause: error,
    });
  }
}

export async function getLiveLocationByDeliveryId(deliveryId: string) {
  try {
    const rows = await db
      .select()
      .from(liveLocations)
      .where(eq(liveLocations.deliveryId, deliveryId));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getLiveLocationByDeliveryId:', error);
    throw new Error('Failed to load live location.', { cause: error });
  }
}

export async function getLocationHistoryByDeliveryId(
  deliveryId: string,
  limit = 60
) {
  try {
    const rows = await db
      .select()
      .from(locationHistory)
      .where(eq(locationHistory.deliveryId, deliveryId))
      .orderBy(desc(locationHistory.recordedAt))
      .limit(limit);
    return rows.reverse();
  } catch (error) {
    console.error(
      'Database query failed in getLocationHistoryByDeliveryId:',
      error
    );
    throw new Error('Failed to load delivery tracking history.', {
      cause: error,
    });
  }
}

export async function updateDeliveryLocationStatus(
  deliveryId: string,
  deliveryStatus: string
) {
  try {
    const rows = await db
      .update(liveLocations)
      .set({
        deliveryStatus,
        updatedAt: new Date(),
      })
      .where(eq(liveLocations.deliveryId, deliveryId))
      .returning();
    return rows[0] || null;
  } catch (error) {
    console.error(
      'Database query failed in updateDeliveryLocationStatus:',
      error
    );
    throw new Error('Failed to update delivery location status.', {
      cause: error,
    });
  }
}

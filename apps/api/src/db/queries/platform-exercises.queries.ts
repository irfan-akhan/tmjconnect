import { count, desc, eq } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { exercises, providerDetails, profiles, users } from '../schema';

type DbClient = Db['db'];

type PlatformExerciseInput = {
  title: string;
  description?: string | null;
  duration_seconds?: number | null;
  category?: string | null;
  instructions?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  status?: 'draft' | 'published' | 'archived';
};

export async function listPlatformExercises(db: DbClient, limit: number, offset: number) {
  return db
    .select({
      id: exercises.id,
      owner_type: exercises.owner_type,
      provider_id: exercises.provider_id,
      status: exercises.status,
      title: exercises.title,
      description: exercises.description,
      duration_seconds: exercises.duration_seconds,
      category: exercises.category,
      instructions: exercises.instructions,
      video_url: exercises.video_url,
      thumbnail_url: exercises.thumbnail_url,
      created_at: exercises.created_at,
      updated_at: exercises.updated_at,
      provider_email: users.email,
      provider_first_name: profiles.first_name,
      provider_last_name: profiles.last_name,
      provider_clinic_name: providerDetails.clinic_name,
      provider_specialty: providerDetails.specialty,
      provider_license_number: providerDetails.license_number,
      provider_license_type: providerDetails.license_type,
      provider_credentials: providerDetails.credentials,
    })
    .from(exercises)
    .leftJoin(users, eq(exercises.provider_id, users.id))
    .leftJoin(profiles, eq(exercises.provider_id, profiles.user_id))
    .leftJoin(providerDetails, eq(exercises.provider_id, providerDetails.user_id))
    .orderBy(desc(exercises.created_at))
    .limit(limit)
    .offset(offset);
}

export async function countPlatformExercises(db: DbClient) {
  const [row] = await db
    .select({ total: count() })
    .from(exercises);
  return row?.total ?? 0;
}

export async function insertPlatformExercise(db: DbClient, data: PlatformExerciseInput) {
  const [row] = await db
    .insert(exercises)
    .values({
      owner_type: 'platform',
      provider_id: null,
      status: data.status ?? 'draft',
      title: data.title,
      description: data.description ?? null,
      duration_seconds: data.duration_seconds ?? null,
      category: data.category ?? null,
      instructions: data.instructions ?? null,
      video_url: data.video_url ?? null,
      thumbnail_url: data.thumbnail_url ?? null,
    })
    .returning();
  return row;
}

export async function updatePlatformExercise(
  db: DbClient,
  id: string,
  data: Partial<PlatformExerciseInput>,
) {
  const [row] = await db
    .update(exercises)
    .set({ ...data, updated_at: new Date() })
    .where(eq(exercises.id, id))
    .returning();
  return row ?? null;
}
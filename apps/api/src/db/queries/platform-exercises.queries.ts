import { and, count, desc, eq } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { exercises } from '../schema';

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
    .select()
    .from(exercises)
    .where(eq(exercises.owner_type, 'platform'))
    .orderBy(desc(exercises.created_at))
    .limit(limit)
    .offset(offset);
}

export async function countPlatformExercises(db: DbClient) {
  const [row] = await db
    .select({ total: count() })
    .from(exercises)
    .where(eq(exercises.owner_type, 'platform'));
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
    .where(and(eq(exercises.id, id), eq(exercises.owner_type, 'platform')))
    .returning();
  return row ?? null;
}
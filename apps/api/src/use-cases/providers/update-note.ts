import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { updateNote } from '../../db/queries/clinical-notes.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateNoteInput = {
  providerId: string;
  noteId: string;
  fields: { body?: string; tags?: string[] };
};

export async function execute(deps: Deps, input: UpdateNoteInput) {
  const provider = { id: input.providerId, role: 'provider' as const };
  const updated = await updateNote(deps.db, input.noteId, provider, input.fields);
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Note not found.');
  return updated;
}

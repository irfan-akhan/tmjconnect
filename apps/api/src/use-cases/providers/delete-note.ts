import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { deleteNote } from '../../db/queries/clinical-notes.queries';

type Deps = Pick<Container, 'db'>;

export type DeleteNoteInput = { providerId: string; noteId: string };

export async function execute(deps: Deps, input: DeleteNoteInput) {
  const ok = await deleteNote(deps.db, input.noteId, input.providerId);
  if (!ok) throw new AppError(404, 'NOT_FOUND', 'Note not found.');
}

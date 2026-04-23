import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Wrap an async mutation so success / error surface through the toast system.
 * Usage: `handleMutation(mutation.mutateAsync(body), { success: 'Saved.' })`
 */
export async function handleMutation<T>(
  promise: Promise<T>,
  opts: { success?: string; error?: (err: Error) => string } = {},
): Promise<T | null> {
  try {
    const result = await promise;
    if (opts.success) toast.success(opts.success);
    return result;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    toast.error(opts.error ? opts.error(e) : e.message);
    return null;
  }
}

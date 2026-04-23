import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
/**
 * Wrap an async mutation so success / error surface through the toast system.
 * Usage: `handleMutation(mutation.mutateAsync(body), { success: 'Saved.' })`
 */
export async function handleMutation(promise, opts = {}) {
    try {
        const result = await promise;
        if (opts.success)
            toast.success(opts.success);
        return result;
    }
    catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        toast.error(opts.error ? opts.error(e) : e.message);
        return null;
    }
}

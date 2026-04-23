import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { useCreateExercise, useUpdateExercise, uploadVideo, } from './queries';
export function ExerciseFormDialog({ open, onOpenChange, exercise }) {
    const isEdit = Boolean(exercise);
    const create = useCreateExercise();
    const update = useUpdateExercise(exercise?.id ?? '');
    const [form, setForm] = useState(() => ({
        title: exercise?.title ?? '',
        description: exercise?.description ?? '',
        category: exercise?.category ?? '',
        instructions: exercise?.instructions ?? '',
        duration_seconds: exercise?.duration_seconds ?? null,
        video_url: exercise?.video_url ?? null,
        thumbnail_url: exercise?.thumbnail_url ?? null,
    }));
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const fileRef = useRef(null);
    function update_(k, v) {
        setForm((f) => ({ ...f, [k]: v }));
    }
    async function onPickVideo(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploading(true);
        setUploadError(null);
        try {
            const { url } = await uploadVideo(file);
            update_('video_url', url);
        }
        catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        }
        finally {
            setUploading(false);
            if (fileRef.current)
                fileRef.current.value = '';
        }
    }
    async function onSubmit(e) {
        e.preventDefault();
        const payload = {
            ...form,
            description: form.description || null,
            category: form.category || null,
            instructions: form.instructions || null,
        };
        if (isEdit) {
            await update.mutateAsync(payload);
        }
        else {
            await create.mutateAsync(payload);
        }
        onOpenChange(false);
    }
    const mutation = isEdit ? update : create;
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: isEdit ? 'Edit exercise' : 'New exercise' }), _jsx(DialogTitle, { children: isEdit ? 'Refine the prescription.' : (_jsxs(_Fragment, { children: ["Something new for ", _jsx("em", { className: "text-accent", children: "the library." })] })) }), _jsx(DialogDescription, { children: "Patients see the title, description, and video you upload here." })] }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "title", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Title" }), _jsx(Input, { id: "title", required: true, value: form.title, onChange: (e) => update_('title', e.target.value), placeholder: "e.g. Jaw relaxation \u2014 controlled opening" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "category", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Category" }), _jsx(Input, { id: "category", value: form.category ?? '', onChange: (e) => update_('category', e.target.value), placeholder: "e.g. Mobility" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "duration", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Duration \u00B7 seconds" }), _jsx(Input, { id: "duration", type: "number", min: 1, value: form.duration_seconds ?? '', onChange: (e) => update_('duration_seconds', e.target.value ? Number(e.target.value) : null), placeholder: "120" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "description", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Description" }), _jsx(Textarea, { id: "description", rows: 3, value: form.description ?? '', onChange: (e) => update_('description', e.target.value), placeholder: "A short explainer the patient will read before starting." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "instructions", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Instructions" }), _jsx(Textarea, { id: "instructions", rows: 4, value: form.instructions ?? '', onChange: (e) => update_('instructions', e.target.value), placeholder: "Step-by-step guidance shown alongside the video." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Demonstration video" }), form.video_url ? (_jsxs("div", { className: "flex items-center gap-3 rounded-sm border border-border/70 bg-background p-3", children: [_jsx(Video, { className: "h-5 w-5 stroke-[1.5] text-accent" }), _jsx("span", { className: "truncate font-mono text-xs text-muted-foreground", children: form.video_url }), _jsxs("div", { className: "ml-auto flex gap-2", children: [_jsx("a", { href: form.video_url, target: "_blank", rel: "noreferrer", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground", children: "Preview" }), _jsx("button", { type: "button", onClick: () => update_('video_url', null), className: "font-mono text-[10px] uppercase tracking-[0.22em] text-destructive hover:underline", children: "Remove" })] })] })) : (_jsxs("button", { type: "button", onClick: () => fileRef.current?.click(), disabled: uploading, onDragOver: (e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent', 'bg-accent/5'); }, onDragLeave: (e) => { e.currentTarget.classList.remove('border-accent', 'bg-accent/5'); }, onDrop: (e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('border-accent', 'bg-accent/5');
                                        const file = e.dataTransfer.files?.[0];
                                        if (file && fileRef.current) {
                                            const dt = new DataTransfer();
                                            dt.items.add(file);
                                            fileRef.current.files = dt.files;
                                            fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                                        }
                                    }, className: "flex w-full flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed border-border bg-card/60 py-10 transition-colors hover:border-foreground/40 hover:bg-secondary/40 disabled:opacity-50", children: [_jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-sm bg-background shadow-sm", children: _jsx(Upload, { className: "h-5 w-5 stroke-[1.5] text-muted-foreground" }) }), _jsxs("div", { children: [_jsx("span", { className: "text-sm font-semibold text-foreground", children: uploading ? 'Uploading…' : 'Drag and drop your video here' }), !uploading && (_jsxs("div", { className: "mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: ["or ", _jsx("span", { className: "text-accent underline", children: "browse files" }), " \u00B7 MP4 / MOV \u00B7 max 100MB"] }))] })] })), _jsx("input", { ref: fileRef, type: "file", accept: "video/mp4,video/quicktime,video/webm", className: "hidden", onChange: onPickVideo }), uploadError && _jsx("p", { className: "text-xs text-destructive", children: uploadError })] }), mutation.isError && (_jsx("p", { className: "text-sm text-destructive", children: mutation.error instanceof Error ? mutation.error.message : 'Save failed.' })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: mutation.isPending || uploading, children: mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create exercise' })] })] })] }) }));
}

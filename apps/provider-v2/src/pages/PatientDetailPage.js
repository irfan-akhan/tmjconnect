import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, ArrowRight, BarChart3, Calendar, Check, Dumbbell, FileText, MessageCircle, MoreHorizontal, Send, StickyNote, TriangleAlert, X, } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { usePatientDetail } from '@/features/patients/detail-queries';
import { AssignExerciseDialog } from '@/features/patients/AssignExerciseDialog';
import { RequestReportDialog } from '@/features/patients/RequestReportDialog';
import { FileOnBehalfDialog } from '@/features/patients/FileOnBehalfDialog';
import { useDismissReportRequest, usePatientReportRequests, } from '@/features/patients/report-requests-queries';
import { SkeletonList } from '@/features/patients/tabs/shared';
const SymptomsTab = lazy(() => import('@/features/patients/tabs/SymptomsTab'));
const AssignmentsTab = lazy(() => import('@/features/patients/tabs/AssignmentsTab'));
const ReportsTab = lazy(() => import('@/features/patients/tabs/ReportsTab'));
const NotesTab = lazy(() => import('@/features/patients/tabs/NotesTab'));
const InsightsTab = lazy(() => import('@/features/patients/tabs/InsightsTab'));
function age(dob) {
    if (!dob)
        return null;
    const d = new Date(dob);
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
export function PatientDetailPage() {
    const { patientId = '' } = useParams();
    const patient = usePatientDetail(patientId);
    const [assignOpen, setAssignOpen] = useState(false);
    const [requestOpen, setRequestOpen] = useState(false);
    const [fileOpen, setFileOpen] = useState(false);
    const [fulfillingId, setFulfillingId] = useState();
    const patientName = patient.data
        ? `${patient.data.first_name} ${patient.data.last_name}`
        : undefined;
    function openFileOnBehalf(fulfilling) {
        setFulfillingId(fulfilling);
        setFileOpen(true);
    }
    return (_jsxs("div", { className: "mx-auto max-w-7xl space-y-6", children: [_jsx(PatientHeader, { patient: patient.data, loading: patient.isLoading, onAssign: () => setAssignOpen(true), onRequest: () => setRequestOpen(true), onFile: () => openFileOnBehalf() }), _jsx(PendingRequestsStrip, { patientId: patientId, onFulfill: (id) => openFileOnBehalf(id) }), _jsxs(Tabs, { defaultValue: "symptoms", children: [_jsxs(TabsList, { children: [_jsxs(TabsTrigger, { value: "symptoms", children: [_jsx(Activity, { className: "h-3.5 w-3.5 stroke-[1.5]" }), "Symptoms"] }), _jsxs(TabsTrigger, { value: "assignments", children: [_jsx(Dumbbell, { className: "h-3.5 w-3.5 stroke-[1.5]" }), "Exercises"] }), _jsxs(TabsTrigger, { value: "reports", children: [_jsx(FileText, { className: "h-3.5 w-3.5 stroke-[1.5]" }), "Reports"] }), _jsxs(TabsTrigger, { value: "insights", children: [_jsx(BarChart3, { className: "h-3.5 w-3.5 stroke-[1.5]" }), "Insights"] }), _jsxs(TabsTrigger, { value: "notes", children: [_jsx(StickyNote, { className: "h-3.5 w-3.5 stroke-[1.5]" }), "Notes"] })] }), _jsx(TabsContent, { value: "symptoms", children: _jsx(Suspense, { fallback: _jsx(SkeletonList, {}), children: _jsx(SymptomsTab, { patientId: patientId }) }) }), _jsx(TabsContent, { value: "assignments", children: _jsx(Suspense, { fallback: _jsx(SkeletonList, {}), children: _jsx(AssignmentsTab, { patientId: patientId, onAssign: () => setAssignOpen(true) }) }) }), _jsx(TabsContent, { value: "reports", children: _jsx(Suspense, { fallback: _jsx(SkeletonList, {}), children: _jsx(ReportsTab, { patientId: patientId }) }) }), _jsx(TabsContent, { value: "insights", children: _jsx(Suspense, { fallback: _jsx(SkeletonList, {}), children: _jsx(InsightsTab, { patientId: patientId }) }) }), _jsx(TabsContent, { value: "notes", children: _jsx(Suspense, { fallback: _jsx(SkeletonList, {}), children: _jsx(NotesTab, { patientId: patientId }) }) })] }), _jsx(RequestReportDialog, { open: requestOpen, onOpenChange: setRequestOpen, patientId: patientId, patientName: patientName }), _jsx(FileOnBehalfDialog, { open: fileOpen, onOpenChange: setFileOpen, patientId: patientId, patientName: patientName, fulfillingRequestId: fulfillingId }), _jsx(AssignExerciseDialog, { open: assignOpen, onOpenChange: setAssignOpen, patientId: patientId, patientName: patientName })] }));
}
function PatientHeader({ patient, loading, onAssign, onRequest, onFile, }) {
    if (loading || !patient) {
        return (_jsx("div", { className: "rounded-sm border border-border/70 bg-card p-6", children: _jsxs("div", { className: "flex items-start gap-5", children: [_jsx(Skeleton, { className: "h-16 w-16" }), _jsxs("div", { className: "flex-1 space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-24" }), _jsx(Skeleton, { className: "h-8 w-72" }), _jsx(Skeleton, { className: "h-4 w-96" })] })] }) }));
    }
    const yrs = age(patient.date_of_birth);
    const location = [patient.city, patient.state].filter(Boolean).join(', ');
    // TODO(api): patient detail endpoint doesn't return diagnosis, linked_at, or
    // urgency yet — these fields are placeholders or omitted until exposed.
    const diagnosis = 'TMJ disorder';
    // TODO(api): expose acute urgency on patient detail; treating "no flag" for now.
    const urgency = null;
    return (_jsxs("div", { className: "rounded-sm border border-border/70 bg-card p-6 shadow-navy-xs", children: [_jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between", children: [_jsxs("div", { className: "flex flex-1 items-start gap-5", children: [_jsxs(Avatar, { size: "lg", children: [patient.avatar_url && _jsx(AvatarImage, { src: patient.avatar_url, alt: "" }), _jsx(AvatarFallback, { className: "bg-navy-600 text-background", children: initials(patient.first_name, patient.last_name) })] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("h1", { className: "font-serif text-3xl tracking-tightest sm:text-4xl", children: [patient.first_name, " ", patient.last_name] }), urgency === 'urgent' && (_jsxs(Badge, { variant: "urgent", size: "md", children: [_jsx(TriangleAlert, { className: "h-3 w-3" }), "Urgent"] }))] }), _jsxs("dl", { className: "mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [patient.gender && _jsx(Tag, { children: patient.gender }), yrs != null && _jsxs(Tag, { children: [yrs, " yrs"] }), _jsx(Tag, { children: _jsx("span", { className: "text-foreground", children: diagnosis }) }), _jsxs(Tag, { children: ["Email \u00B7 ", _jsx("span", { className: "text-foreground normal-case", children: patient.email })] }), location && (_jsxs(Tag, { children: ["Location \u00B7", ' ', _jsx("span", { className: "text-foreground normal-case", children: location })] }))] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 lg:shrink-0", children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(MessageCircle, { className: "mr-2 h-3.5 w-3.5" }), "Message"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: onAssign, children: [_jsx(Dumbbell, { className: "mr-2 h-3.5 w-3.5" }), "Assign exercise"] }), _jsxs(Button, { size: "sm", children: ["Respond to report", _jsx(ArrowRight, { className: "ml-2 h-3.5 w-3.5" })] }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", "aria-label": "More actions", children: _jsx(MoreHorizontal, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onSelect: onRequest, children: [_jsx(Send, { className: "h-3.5 w-3.5" }), "Request a report"] }), _jsxs(DropdownMenuItem, { onSelect: onFile, children: [_jsx(FileText, { className: "h-3.5 w-3.5" }), "File on their behalf"] })] })] })] })] }), _jsxs("div", { className: "mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 sm:grid-cols-4", children: [_jsx(Vital, { label: "Exercise adherence", value: "\u2014", hint: "Past 7 days", icon: _jsx(Dumbbell, { className: "h-3.5 w-3.5" }) }), _jsx(Vital, { label: "Avg pain \u00B7 7d", value: "\u2014", hint: "From symptom logs", icon: _jsx(Activity, { className: "h-3.5 w-3.5" }) }), _jsx(Vital, { label: "Linked since", value: "\u2014", hint: "Time on platform", icon: _jsx(Calendar, { className: "h-3.5 w-3.5" }) }), _jsx(Vital, { label: "Last activity", value: "\u2014", hint: "Symptom or report", icon: _jsx(MessageCircle, { className: "h-3.5 w-3.5" }) })] })] }));
}
function Vital({ label, value, hint, icon, }) {
    return (_jsxs("div", { className: "bg-card p-4", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: label }), _jsx("span", { className: "text-muted-foreground", children: icon })] }), _jsx("div", { className: "font-serif text-3xl leading-none tracking-tightest text-foreground", children: value }), _jsx("div", { className: "mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: hint })] }));
}
function Tag({ children }) {
    return _jsx("span", { className: "inline-flex items-center", children: children });
}
function PendingRequestsStrip({ patientId, onFulfill, }) {
    const q = usePatientReportRequests(patientId);
    const dismiss = useDismissReportRequest(patientId);
    const pending = (q.data ?? []).filter((r) => r.status === 'pending');
    if (pending.length === 0)
        return null;
    return (_jsxs("section", { className: "rounded-sm border border-gold-600/30 bg-gold-100/40 p-4", children: [_jsx("div", { className: "mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: _jsxs("span", { children: ["Pending report requests \u00B7", ' ', _jsx("span", { className: "text-gold-700", children: pending.length.toString().padStart(2, '0') })] }) }), _jsx("ul", { className: "space-y-2", children: pending.map((r) => (_jsxs("li", { className: cn('grid grid-cols-[1fr_auto] items-start gap-4 rounded-sm border border-border/70 bg-card px-4 py-3'), children: [_jsxs("div", { children: [_jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Sent ", format(new Date(r.created_at), 'd MMM yyyy · HH:mm'), " \u00B7", ' ', formatDistanceToNow(new Date(r.created_at), { addSuffix: true })] }), _jsx("p", { className: "mt-1 text-sm leading-relaxed", children: r.prompt })] }), _jsxs("div", { className: "flex gap-1", children: [_jsxs(Button, { size: "sm", variant: "outline", onClick: () => onFulfill(r.id), children: [_jsx(Check, { className: "mr-1 h-3 w-3" }), "File now"] }), _jsx(Button, { size: "icon", variant: "ghost", onClick: () => dismiss.mutate(r.id), disabled: dismiss.isPending, "aria-label": "Dismiss request", children: _jsx(X, { className: "h-4 w-4" }) })] })] }, r.id))) })] }));
}

import { lazy, Suspense, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  Dumbbell,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Send,
  StickyNote,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { usePatientDetail } from '@/features/patients/detail-queries';
import { AssignExerciseDialog } from '@/features/patients/AssignExerciseDialog';
import { RequestReportDialog } from '@/features/patients/RequestReportDialog';
import { FileOnBehalfDialog } from '@/features/patients/FileOnBehalfDialog';
import {
  useDismissReportRequest,
  usePatientReportRequests,
  type ReportRequest,
} from '@/features/patients/report-requests-queries';
import { SkeletonList } from '@/features/patients/tabs/shared';

const SymptomsTab = lazy(() => import('@/features/patients/tabs/SymptomsTab'));
const AssignmentsTab = lazy(() => import('@/features/patients/tabs/AssignmentsTab'));
const ReportsTab = lazy(() => import('@/features/patients/tabs/ReportsTab'));
const NotesTab = lazy(() => import('@/features/patients/tabs/NotesTab'));
const InsightsTab = lazy(() => import('@/features/patients/tabs/InsightsTab'));

function age(dob: string | null) {
  if (!dob) return null;
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
  const [fulfillingId, setFulfillingId] = useState<string | undefined>();
  const patientName = patient.data
    ? `${patient.data.first_name} ${patient.data.last_name}`
    : undefined;

  function openFileOnBehalf(fulfilling?: string) {
    setFulfillingId(fulfilling);
    setFileOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PatientHeader
        patient={patient.data}
        loading={patient.isLoading}
        onAssign={() => setAssignOpen(true)}
        onRequest={() => setRequestOpen(true)}
        onFile={() => openFileOnBehalf()}
      />

      <PendingRequestsStrip
        patientId={patientId}
        onFulfill={(id) => openFileOnBehalf(id)}
      />

      <Tabs defaultValue="symptoms">
        <TabsList>
          <TabsTrigger value="symptoms">
            <Activity className="h-3.5 w-3.5 stroke-[1.5]" />
            Symptoms
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <Dumbbell className="h-3.5 w-3.5 stroke-[1.5]" />
            Exercises
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileText className="h-3.5 w-3.5 stroke-[1.5]" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="insights">
            <BarChart3 className="h-3.5 w-3.5 stroke-[1.5]" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-3.5 w-3.5 stroke-[1.5]" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="symptoms">
          <Suspense fallback={<SkeletonList />}>
            <SymptomsTab patientId={patientId} />
          </Suspense>
        </TabsContent>
        <TabsContent value="assignments">
          <Suspense fallback={<SkeletonList />}>
            <AssignmentsTab patientId={patientId} onAssign={() => setAssignOpen(true)} />
          </Suspense>
        </TabsContent>
        <TabsContent value="reports">
          <Suspense fallback={<SkeletonList />}>
            <ReportsTab patientId={patientId} />
          </Suspense>
        </TabsContent>
        <TabsContent value="insights">
          <Suspense fallback={<SkeletonList />}>
            <InsightsTab patientId={patientId} />
          </Suspense>
        </TabsContent>
        <TabsContent value="notes">
          <Suspense fallback={<SkeletonList />}>
            <NotesTab patientId={patientId} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <RequestReportDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        patientId={patientId}
        patientName={patientName}
      />
      <FileOnBehalfDialog
        open={fileOpen}
        onOpenChange={setFileOpen}
        patientId={patientId}
        patientName={patientName}
        fulfillingRequestId={fulfillingId}
      />
      <AssignExerciseDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        patientId={patientId}
        patientName={patientName}
      />
    </div>
  );
}

function PatientHeader({
  patient,
  loading,
  onAssign,
  onRequest,
  onFile,
}: {
  patient?: ReturnType<typeof usePatientDetail>['data'];
  loading: boolean;
  onAssign: () => void;
  onRequest: () => void;
  onFile: () => void;
}) {
  if (loading || !patient) {
    return (
      <div className="rounded-sm border border-border/70 bg-card p-6">
        <div className="flex items-start gap-5">
          <Skeleton className="h-16 w-16" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
      </div>
    );
  }

  const yrs = age(patient.date_of_birth);
  const location = [patient.city, patient.state].filter(Boolean).join(', ');
  // TODO(api): patient detail endpoint doesn't return diagnosis, linked_at, or
  // urgency yet — these fields are placeholders or omitted until exposed.
  const diagnosis = 'TMJ disorder';
  // TODO(api): expose acute urgency on patient detail; treating "no flag" for now.
  const urgency: 'urgent' | 'moderate' | 'stable' | null = null;

  return (
    <div className="rounded-sm border border-border/70 bg-card p-6 shadow-navy-xs">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 items-start gap-5">
          <Avatar size="lg">
            {patient.avatar_url && <AvatarImage src={patient.avatar_url} alt="" />}
            <AvatarFallback className="bg-navy-600 text-background">
              {initials(patient.first_name, patient.last_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl tracking-tightest sm:text-4xl">
                {patient.first_name} {patient.last_name}
              </h1>
              {urgency === 'urgent' && (
                <Badge variant="urgent" size="md">
                  <TriangleAlert className="h-3 w-3" />
                  Urgent
                </Badge>
              )}
            </div>

            <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {patient.gender && <Tag>{patient.gender}</Tag>}
              {yrs != null && <Tag>{yrs} yrs</Tag>}
              <Tag>
                <span className="text-foreground">{diagnosis}</span>
              </Tag>
              <Tag>
                Email · <span className="text-foreground normal-case">{patient.email}</span>
              </Tag>
              {location && (
                <Tag>
                  Location ·{' '}
                  <span className="text-foreground normal-case">{location}</span>
                </Tag>
              )}
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          <Button variant="outline" size="sm">
            <MessageCircle className="mr-2 h-3.5 w-3.5" />
            Message
          </Button>
          <Button variant="outline" size="sm" onClick={onAssign}>
            <Dumbbell className="mr-2 h-3.5 w-3.5" />
            Assign exercise
          </Button>
          <Button size="sm">
            Respond to report
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onRequest}>
                <Send className="h-3.5 w-3.5" />
                Request a report
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onFile}>
                <FileText className="h-3.5 w-3.5" />
                File on their behalf
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Vitals strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 sm:grid-cols-4">
        <Vital
          label="Exercise adherence"
          value="—"
          hint="Past 7 days"
          icon={<Dumbbell className="h-3.5 w-3.5" />}
        />
        <Vital
          label="Avg pain · 7d"
          value="—"
          hint="From symptom logs"
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <Vital
          label="Linked since"
          value="—"
          hint="Time on platform"
          icon={<Calendar className="h-3.5 w-3.5" />}
        />
        <Vital
          label="Last activity"
          value="—"
          hint="Symptom or report"
          icon={<MessageCircle className="h-3.5 w-3.5" />}
        />
      </div>
      {/* TODO(api): patient detail doesn't return adherence %, avg_pain_7d, linked_at,
          or last_activity_at — vitals are blank placeholders until those fields land. */}
    </div>
  );
}

function Vital({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="font-serif text-3xl leading-none tracking-tightest text-foreground">
        {value}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {hint}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center">{children}</span>;
}

function PendingRequestsStrip({
  patientId,
  onFulfill,
}: {
  patientId: string;
  onFulfill: (requestId: string) => void;
}) {
  const q = usePatientReportRequests(patientId);
  const dismiss = useDismissReportRequest(patientId);
  const pending = (q.data ?? []).filter((r: ReportRequest) => r.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <section className="rounded-sm border border-gold-600/30 bg-gold-100/40 p-4">
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span>
          Pending report requests ·{' '}
          <span className="text-gold-700">{pending.length.toString().padStart(2, '0')}</span>
        </span>
      </div>
      <ul className="space-y-2">
        {pending.map((r) => (
          <li
            key={r.id}
            className={cn(
              'grid grid-cols-[1fr_auto] items-start gap-4 rounded-sm border border-border/70 bg-card px-4 py-3',
            )}
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Sent {format(new Date(r.created_at), 'd MMM yyyy · HH:mm')} ·{' '}
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </div>
              <p className="mt-1 text-sm leading-relaxed">{r.prompt}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => onFulfill(r.id)}>
                <Check className="mr-1 h-3 w-3" />
                File now
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => dismiss.mutate(r.id)}
                disabled={dismiss.isPending}
                aria-label="Dismiss request"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

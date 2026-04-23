import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  Dumbbell,
  FileText,
  MoreHorizontal,
  Send,
  StickyNote,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Per-tab code splitting — each tab loads only when activated.
const SymptomsTab = lazy(() => import('@/features/patients/tabs/SymptomsTab'));
const AssignmentsTab = lazy(() => import('@/features/patients/tabs/AssignmentsTab'));
const ReportsTab = lazy(() => import('@/features/patients/tabs/ReportsTab'));
const NotesTab = lazy(() => import('@/features/patients/tabs/NotesTab'));
const InsightsTab = lazy(() => import('@/features/patients/tabs/InsightsTab'));

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '—';
}

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
  const patientName = patient.data ? `${patient.data.first_name} ${patient.data.last_name}` : undefined;

  function openFileOnBehalf(fulfilling?: string) {
    setFulfillingId(fulfilling);
    setFileOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div className="flex items-center justify-between">
        <Link
          to="/patients"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to patients
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRequestOpen(true)}>
              <Send className="h-3.5 w-3.5" />
              Request a report
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openFileOnBehalf()}>
              <FileText className="h-3.5 w-3.5" />
              File on their behalf
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <PatientHeader
        patient={patient.data}
        loading={patient.isLoading}
        onNewAssignment={() => setAssignOpen(true)}
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
            Assignments
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
  onNewAssignment,
}: {
  patient?: ReturnType<typeof usePatientDetail>['data'];
  loading: boolean;
  onNewAssignment: () => void;
}) {
  if (loading || !patient) {
    return (
      <div className="grid grid-cols-[auto_1fr] gap-8 border-b border-border/70 pb-10">
        <div className="h-24 w-24 animate-pulse rounded-sm bg-secondary" />
        <div className="space-y-4">
          <div className="h-4 w-32 animate-pulse rounded-sm bg-secondary" />
          <div className="h-10 w-80 animate-pulse rounded-sm bg-secondary" />
          <div className="h-4 w-64 animate-pulse rounded-sm bg-secondary" />
        </div>
      </div>
    );
  }

  const yrs = age(patient.date_of_birth);
  const location = [patient.city, patient.state].filter(Boolean).join(', ');

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-end gap-8 border-b border-border/70 pb-10">
      <div className="flex h-24 w-24 items-center justify-center rounded-sm bg-primary font-serif text-3xl tracking-tightest text-primary-foreground">
        {initials(patient.first_name, patient.last_name)}
      </div>
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Folio № 02 — Patient chart
        </div>
        <h1 className="font-serif text-5xl tracking-tightest">
          {patient.first_name} <em className="text-accent">{patient.last_name}</em>
        </h1>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {yrs != null && (
            <div>
              <dt className="inline text-muted-foreground/60">Age · </dt>
              <dd className="inline text-foreground">{yrs}</dd>
            </div>
          )}
          {patient.gender && (
            <div>
              <dt className="inline text-muted-foreground/60">Gender · </dt>
              <dd className="inline text-foreground">{patient.gender}</dd>
            </div>
          )}
          {location && (
            <div>
              <dt className="inline text-muted-foreground/60">Location · </dt>
              <dd className="inline text-foreground normal-case">{location}</dd>
            </div>
          )}
          <div>
            <dt className="inline text-muted-foreground/60">Email · </dt>
            <dd className="inline text-foreground normal-case">{patient.email}</dd>
          </div>
        </dl>
      </div>
      <div className="flex gap-2">
        <Button onClick={onNewAssignment}>New assignment</Button>
      </div>
    </header>
  );
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
    <section className="space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Pending report requests · {pending.length.toString().padStart(2, '0')}
      </div>
      <ul className="space-y-2">
        {pending.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[1fr_auto] items-start gap-4 rounded-sm border-l-2 border-accent bg-accent/5 px-4 py-3"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Sent {format(new Date(r.created_at), 'd MMM yyyy · HH:mm')}
              </div>
              <p className="mt-1 text-sm leading-relaxed">{r.prompt}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => onFulfill(r.id)}>
                <Check className="h-3.5 w-3.5" />
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

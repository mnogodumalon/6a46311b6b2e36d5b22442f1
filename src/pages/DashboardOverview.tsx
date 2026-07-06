import { useMemo, useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichReparaturauftraege } from '@/lib/enrich';
import type { EnrichedReparaturauftraege } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { lookupKey } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconClock, IconSettings, IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatCard, StatCardRow } from '@/components/StatCard';
import {
  KanbanWidget,
  type KanbanCard,
  type KanbanColumn,
  type KanbanTone,
} from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { ReparaturauftraegeDialog } from '@/components/dialogs/ReparaturauftraegeDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';

const APPGROUP_ID = '6a46311b6b2e36d5b22442f1';
const REPAIR_ENDPOINT = '/claude/build/repair';

const COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['reparaturauftraege']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForStatus(status: string | undefined): KanbanTone {
  if (status === 'fertig') return 'success';
  if (status === 'in_reparatur') return 'primary';
  if (status === 'wartet_auf_teile') return 'warning';
  return 'default'; // angenommen
}

export default function DashboardOverview() {
  const clock = useClock();
  const {
    reparaturauftraege, setReparaturauftraege, kunden,
    kundenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<Partial<EnrichedReparaturauftraege['fields']> | undefined>(undefined);
  const [editRecord, setEditRecord] = useState<EnrichedReparaturauftraege | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const overlay = useRecordOverlayStack<{ id: string }>();

  const enrichedReparaturauftraege = useMemo(
    () => enrichReparaturauftraege(reparaturauftraege, { kundenMap }),
    [reparaturauftraege, kundenMap],
  );

  const today = useMemo(() => {
    const d = clock;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [clock]);

  const offen = useMemo(
    () => enrichedReparaturauftraege.filter(r => lookupKey(r.fields.status) !== 'fertig'),
    [enrichedReparaturauftraege],
  );

  const inReparatur = useMemo(
    () => enrichedReparaturauftraege.filter(r => lookupKey(r.fields.status) === 'in_reparatur'),
    [enrichedReparaturauftraege],
  );

  const fertig = useMemo(
    () => enrichedReparaturauftraege.filter(r => lookupKey(r.fields.status) === 'fertig'),
    [enrichedReparaturauftraege],
  );

  const heuteFaellig = useMemo(
    () => enrichedReparaturauftraege.filter(r => {
      if (r.fields.heute_faellig) return true;
      if (r.fields.zusagedatum && r.fields.zusagedatum <= today && lookupKey(r.fields.status) !== 'fertig') return true;
      return false;
    }),
    [enrichedReparaturauftraege, today],
  );

  const ueberfaellig = useMemo(
    () => enrichedReparaturauftraege.filter(r =>
      r.fields.zusagedatum && r.fields.zusagedatum < today && lookupKey(r.fields.status) !== 'fertig',
    ),
    [enrichedReparaturauftraege, today],
  );

  // Shared status-advance helper: marks as fertig (or advances to next stage)
  const advanceStatus = async (r: EnrichedReparaturauftraege) => {
    const current = lookupKey(r.fields.status);
    const NEXT: Record<string, string> = {
      angenommen: 'in_reparatur',
      in_reparatur: 'fertig',
      wartet_auf_teile: 'in_reparatur',
      fertig: 'fertig',
    };
    const next = NEXT[current ?? ''] ?? 'in_reparatur';
    if (next === current) return;

    const prev = lookupKey(r.fields.status);
    setReparaturauftraege(prev2 =>
      prev2.map(x =>
        x.record_id === r.record_id
          ? { ...x, fields: { ...x.fields, status: { key: next, label: next } } }
          : x,
      ),
    );
    undoToast(
      `${r.fields.hersteller ?? ''} ${r.fields.modell ?? ''} → ${COLUMNS.find(c => c.key === next)?.label ?? next}`,
      async () => {
        setReparaturauftraege(prev2 =>
          prev2.map(x =>
            x.record_id === r.record_id
              ? { ...x, fields: { ...x.fields, status: { key: prev ?? '', label: prev ?? '' } } }
              : x,
          ),
        );
        await LivingAppsService.updateReparaturauftraegeEntry(r.record_id, { status: prev ?? '' });
      },
    );
    try {
      await LivingAppsService.updateReparaturauftraegeEntry(r.record_id, { status: next });
    } catch {
      await fetchAll();
    }
  };

  const filteredCards = useMemo<KanbanCard[]>(
    () =>
      enrichedReparaturauftraege
        .filter(r => !statusFilter || lookupKey(r.fields.status) === statusFilter)
        .map(r => {
          const status = lookupKey(r.fields.status) ?? COLUMNS[0]?.key ?? '';
          return {
            id: `rep:${r.record_id}`,
            column: status,
            title: `${r.fields.hersteller ?? '—'} ${r.fields.modell ?? ''}`.trim(),
            subtitle: r.kundeName
              ? `${r.kundeName}${r.fields.zusagedatum ? ' · Bis ' + formatDate(r.fields.zusagedatum) : ''}`
              : r.fields.auftragsnummer,
            tone: toneForStatus(status),
          };
        }),
    [enrichedReparaturauftraege, statusFilter],
  );

  const moveCard = async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const r = enrichedReparaturauftraege.find(x => x.record_id === rid);
    if (!r) return;
    const prev = lookupKey(r.fields.status) ?? '';
    setReparaturauftraege(prev2 =>
      prev2.map(x =>
        x.record_id === rid
          ? { ...x, fields: { ...x.fields, status: { key: newColumn, label: newColumn } } }
          : x,
      ),
    );
    undoToast(
      `${r.fields.hersteller ?? ''} ${r.fields.modell ?? ''} → ${COLUMNS.find(c => c.key === newColumn)?.label ?? newColumn}`,
      async () => {
        setReparaturauftraege(prev2 =>
          prev2.map(x =>
            x.record_id === rid
              ? { ...x, fields: { ...x.fields, status: { key: prev, label: prev } } }
              : x,
          ),
        );
        await LivingAppsService.updateReparaturauftraegeEntry(rid, { status: prev });
      },
    );
    try {
      await LivingAppsService.updateReparaturauftraegeEntry(rid, { status: newColumn });
    } catch {
      await fetchAll();
    }
  };

  const overlayRecord = overlay.top
    ? enrichedReparaturauftraege.find(r => r.record_id === overlay.top!.id)
    : undefined;

  const nextStatus = overlayRecord ? (() => {
    const NEXT: Record<string, string> = {
      angenommen: 'in_reparatur',
      in_reparatur: 'fertig',
      wartet_auf_teile: 'in_reparatur',
    };
    return NEXT[lookupKey(overlayRecord.fields.status) ?? ''];
  })() : undefined;

  const contextLine = useMemo(() => {
    if (enrichedReparaturauftraege.length === 0) return 'Noch keine Aufträge — leg jetzt los!';
    if (ueberfaellig.length > 0) {
      const names = namen(ueberfaellig.map(r => `${r.fields.hersteller ?? ''} ${r.fields.modell ?? ''}`.trim()));
      return `${ueberfaellig.length === 1 ? 'Auftrag' : `${ueberfaellig.length} Aufträge`} überfällig: ${names}.`;
    }
    if (heuteFaellig.length > 0) {
      const names = namen(heuteFaellig.map(r => r.kundeName || `${r.fields.hersteller ?? ''} ${r.fields.modell ?? ''}`.trim()));
      return `Heute fällig: ${names}.`;
    }
    if (inReparatur.length > 0) {
      return `${inReparatur.length} ${inReparatur.length === 1 ? 'Gerät' : 'Geräte'} in Reparatur — alles im Zeitplan.`;
    }
    return `${offen.length} offene ${offen.length === 1 ? 'Auftrag' : 'Aufträge'}.`;
  }, [enrichedReparaturauftraege, ueberfaellig, heuteFaellig, inReparatur, offen]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const isEmpty = enrichedReparaturauftraege.length === 0;

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-1">{contextLine}</p>
        </div>
        <Button
          onClick={() => { setCreateDefaults(undefined); setCreateOpen(true); }}
          className="shrink-0"
        >
          <IconPlus size={16} className="shrink-0 mr-1" />
          Neuer Auftrag
        </Button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-[27px] bg-card shadow-lg">
          <IconSettings size={48} className="text-muted-foreground" stroke={1.5} />
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-1">Richte deine Werkstatt ein</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Erfasse deinen ersten Reparaturauftrag und behalte alle Geräte im Blick.</p>
          </div>
          <Button onClick={() => { setCreateDefaults(undefined); setCreateOpen(true); }}>
            <IconPlus size={16} className="mr-1" />
            Ersten Auftrag aufnehmen
          </Button>
        </div>
      ) : (
        <DashboardGrid
          variant="wide"
          hero={
            ueberfaellig.length > 0 && (
              <HeroBanner
                icon={<IconAlertTriangle size={18} />}
                tone="destructive"
                action={{
                  label: 'Status setzen',
                  onClick: () => advanceStatus(ueberfaellig[0]),
                }}
              >
                <b>{namen(ueberfaellig.map(r => `${r.fields.hersteller ?? ''} ${r.fields.modell ?? ''}`.trim()))}</b>{' '}
                {ueberfaellig.length === 1 ? 'ist überfällig' : 'sind überfällig'} — Zusagedatum war {formatDate(ueberfaellig[0].fields.zusagedatum)}.
              </HeroBanner>
            )
          }
          kpis={
            <StatCardRow>
              <StatCard
                title="Offen"
                value={offen.length}
                description={offen.length > 0 ? 'In Bearbeitung' : 'Alle erledigt'}
                icon={<IconSettings size={18} className="text-muted-foreground" />}
                tone={offen.length > 0 ? 'primary' : 'success'}
                onClick={() => setStatusFilter(f => f ? null : 'angenommen')}
                active={statusFilter === 'angenommen'}
              />
              <StatCard
                title="Heute fällig"
                value={heuteFaellig.length}
                description={heuteFaellig.length > 0 ? 'Jetzt abschließen' : 'Alles pünktlich'}
                icon={<IconClock size={18} className="text-muted-foreground" />}
                tone={heuteFaellig.length > 0 ? 'warning' : 'default'}
                onClick={() => setStatusFilter(f => f === '__heute__' ? null : '__heute__')}
                active={statusFilter === '__heute__'}
              />
              <StatCard
                title="Fertig"
                value={fertig.length}
                description={fertig.length > 0 ? 'Zur Abholung bereit' : 'Noch nichts fertig'}
                icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
                tone={fertig.length > 0 ? 'success' : 'default'}
                onClick={() => setStatusFilter(f => f === 'fertig' ? null : 'fertig')}
                active={statusFilter === 'fertig'}
              />
            </StatCardRow>
          }
          primary={
            <KanbanWidget
              cards={filteredCards}
              columns={COLUMNS}
              defaultCollapsed={['fertig']}
              onCardClick={card => overlay.replace({ id: card.id.split(':')[1] ?? '' })}
              onCardMove={moveCard}
              onAddCard={column => {
                const colLabel = (LOOKUP_OPTIONS['reparaturauftraege']?.['status'] ?? []).find(o => o.key === column)?.label ?? column;
                setCreateDefaults({ status: { key: column, label: colLabel } });
                setCreateOpen(true);
              }}
            />
          }
          aside={
            <>
              <WorkList
                title="Fällig & überfällig"
                icon={<IconAlertTriangle size={14} className="shrink-0" />}
                items={[...ueberfaellig, ...heuteFaellig.filter(r => !ueberfaellig.includes(r))]
                  .sort((a, b) => (a.fields.zusagedatum ?? '').localeCompare(b.fields.zusagedatum ?? ''))
                  .map(r => ({
                    id: r.record_id,
                    title: `${r.fields.hersteller ?? '—'} ${r.fields.modell ?? ''}`.trim(),
                    secondLine: (
                      <>
                        <span className={ueberfaellig.includes(r) ? 'font-medium text-destructive' : 'font-medium text-amber-600'}>
                          {ueberfaellig.includes(r) ? 'Überfällig' : 'Heute fällig'}
                        </span>
                        {r.kundeName && <span className="text-muted-foreground"> · {r.kundeName}</span>}
                        {r.fields.zusagedatum && <span className="text-muted-foreground"> · {formatDate(r.fields.zusagedatum)}</span>}
                      </>
                    ),
                    action: {
                      label: '→ Weiterschalten',
                      onClick: () => advanceStatus(r),
                    },
                  }))}
                onItemClick={id => overlay.replace({ id })}
                empty={{
                  text: 'Alle Aufträge im Zeitplan — super!',
                  action: { label: 'Neuer Auftrag', onClick: () => { setCreateDefaults(undefined); setCreateOpen(true); } },
                }}
              />
              <WorkList
                title="Fertig zur Abholung"
                icon={<IconCircleCheck size={14} className="shrink-0" />}
                items={fertig.map(r => ({
                  id: r.record_id,
                  title: `${r.fields.hersteller ?? '—'} ${r.fields.modell ?? ''}`.trim(),
                  secondLine: (
                    <>
                      <span className="font-medium text-emerald-600">Fertig</span>
                      {r.kundeName && <span className="text-muted-foreground"> · {r.kundeName}</span>}
                      {r.fields.zusagedatum && <span className="text-muted-foreground"> · {formatDate(r.fields.zusagedatum)}</span>}
                    </>
                  ),
                }))}
                onItemClick={id => overlay.replace({ id })}
                empty={{
                  text: inReparatur.length > 0
                    ? `${inReparatur.length} ${inReparatur.length === 1 ? 'Gerät' : 'Geräte'} in Reparatur`
                    : 'Noch keine Aufträge abgeschlossen',
                }}
              />
            </>
          }
        />
      )}

      {/* Create/Edit Dialog */}
      <ReparaturauftraegeDialog
        open={createOpen || !!editRecord}
        onClose={() => { setCreateOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await LivingAppsService.updateReparaturauftraegeEntry(editRecord.record_id, fields);
          } else {
            await LivingAppsService.createReparaturauftraegeEntry(fields);
          }
          await fetchAll();
        }}
        defaultValues={editRecord ? editRecord.fields : createDefaults}
        recordId={editRecord?.record_id}
        kundenList={kunden}
        enablePhotoScan={AI_PHOTO_SCAN['Reparaturauftraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Reparaturauftraege']}
      />

      {/* Record Overlay */}
      <RecordOverlay
        open={overlay.open}
        onClose={overlay.close}
        onEdit={overlayRecord ? () => { setEditRecord(overlayRecord); overlay.close(); } : undefined}
        ariaLabel="Reparaturauftrag"
        footer={
          nextStatus && overlayRecord
            ? (
                <button
                  type="button"
                  className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
                  onClick={() => { advanceStatus(overlayRecord); overlay.close(); }}
                >
                  → {COLUMNS.find(c => c.key === nextStatus)?.label ?? nextStatus}
                </button>
              )
            : undefined
        }
      >
        {overlayRecord && (
          <>
            <RecordHeader
              title={`${overlayRecord.fields.hersteller ?? '—'} ${overlayRecord.fields.modell ?? ''}`.trim()}
              subtitle={overlayRecord.fields.status?.label}
              badges={
                overlayRecord.kundeName
                  ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{overlayRecord.kundeName}</span>
                  : undefined
              }
            />
            <RecordSection title="Auftrag" cols={2}>
              <RecordField label="Auftragsnummer" value={overlayRecord.fields.auftragsnummer} />
              <RecordField label="Status" value={overlayRecord.fields.status} format="pill" />
              <RecordField label="Kunde" value={overlayRecord.kundeName || '—'} />
              <RecordField label="Zusagedatum" value={overlayRecord.fields.zusagedatum} format="date" />
              <RecordField label="Heute fällig" value={overlayRecord.fields.heute_faellig} format="bool" />
            </RecordSection>
            <RecordSection title="Gerät">
              <RecordField label="Hersteller" value={overlayRecord.fields.hersteller} />
              <RecordField label="Modell" value={overlayRecord.fields.modell} />
              <RecordField label="Fehlerbeschreibung" value={overlayRecord.fields.fehlerbeschreibung} format="longtext" />
            </RecordSection>
            {overlayRecord.fields.interne_notizen && (
              <RecordSection title="Interne Notizen">
                <RecordField label="" value={overlayRecord.fields.interne_notizen} format="longtext" />
              </RecordSection>
            )}
            <RecordAttachments appId={APP_IDS.REPARATURAUFTRAEGE} recordId={overlayRecord.record_id} />
          </>
        )}
      </RecordOverlay>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}

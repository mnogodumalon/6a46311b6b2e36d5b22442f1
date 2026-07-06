import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Reparaturauftraege, Kunden } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { ReparaturauftraegeDialog } from '@/components/dialogs/ReparaturauftraegeDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Reparaturauftraege';
import { evalComputed } from '@/config/form-enhancements/types';

export default function ReparaturauftraegeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Reparaturauftraege | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [kundenList, setKundenList] = useState<Kunden[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, kundenData] = await Promise.all([
        LivingAppsService.getReparaturauftraege(),
        LivingAppsService.getKunden(),
      ]);
      setKundenList(kundenData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Reparaturauftraege['fields']) {
    if (!record) return;
    await LivingAppsService.updateReparaturauftraegeEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteReparaturauftraegeEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/reparaturauftraege');
  }

  function getKundenDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return kundenList.find(r => r.record_id === refId)?.fields.vorname ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/reparaturauftraege')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/reparaturauftraege')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.auftragsnummer ?? 'Reparaturaufträge'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          kunde: kundenList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Auftragsnummer" value={record.fields.auftragsnummer} format="text" />
        <RecordField label="Kunde" value={getKundenDisplayName(record.fields.kunde)} format="text" />
        <RecordField label="Hersteller" value={record.fields.hersteller} format="text" />
        <RecordField label="Modell" value={record.fields.modell} format="text" />
        <RecordField label="Fehlerbeschreibung" value={record.fields.fehlerbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label="Zusagedatum" value={record.fields.zusagedatum} format="date" />
        <RecordField label="Status" value={record.fields.status} format="pill" />
        <RecordField label="Heute fällig" value={record.fields.heute_faellig} format="bool" />
        <RecordField label="Interne Notizen" value={record.fields.interne_notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.REPARATURAUFTRAEGE} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <ReparaturauftraegeDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        kundenList={kundenList}
        enablePhotoScan={AI_PHOTO_SCAN['Reparaturauftraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Reparaturauftraege']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Reparaturaufträge löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}

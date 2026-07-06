// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Reparaturauftraege {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    auftragsnummer?: string;
    kunde?: string; // applookup -> URL zu 'Kunden' Record
    hersteller?: string;
    modell?: string;
    fehlerbeschreibung?: string;
    zusagedatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    heute_faellig?: boolean;
    interne_notizen?: string;
  };
}

export interface Kunden {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    email?: string;
    vorname?: string;
    nachname?: string;
    telefon?: string;
  };
}

export const APP_IDS = {
  REPARATURAUFTRAEGE: '6a463108843b6cd2d180b8f9',
  KUNDEN: '6a463104399c364351f91e8a',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'reparaturauftraege': {
    status: [{ key: "angenommen", label: "Angenommen" }, { key: "in_reparatur", label: "In Reparatur" }, { key: "wartet_auf_teile", label: "Wartet auf Teile" }, { key: "fertig", label: "Fertig" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'reparaturauftraege': {
    'auftragsnummer': 'string/text',
    'kunde': 'applookup/select',
    'hersteller': 'string/text',
    'modell': 'string/text',
    'fehlerbeschreibung': 'string/textarea',
    'zusagedatum': 'date/date',
    'status': 'lookup/select',
    'heute_faellig': 'bool',
    'interne_notizen': 'string/textarea',
  },
  'kunden': {
    'email': 'string/email',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'telefon': 'string/tel',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateReparaturauftraege = StripLookup<Reparaturauftraege['fields']>;
export type CreateKunden = StripLookup<Kunden['fields']>;
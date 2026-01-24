import { getApiClient, getMockApiClient } from '../../../core/api/axiosClient';
import type { Service, ServiceFeeItem } from '../../../core/domain/service';
import type { TimeSlot } from '../../../core/domain/timeSlot';
import { convertToJod } from '../../../shared/utils/format';

type BackendServiceListItem = {
  id: string;
  canonicalName: string;
  description?: string | null;
  isActive: boolean;
  // NOTE: Some backend versions may include this on the list response.
  price?: string | number | null;
  currency?: string | null;
  fees?: Array<{
    description?: string | null;
    amount: string | number;
    currency: string;
  }>;
  hasMultipleFees?: boolean;
};

type BackendServiceDocument = {
  id: string;
  documentName: string;
  isRequired: boolean;
};

type BackendServiceDetails = BackendServiceListItem & {
  documents?: BackendServiceDocument[];
  price?: string | number | null;
};

function parseFeeAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mapFeesBreakdown(svc: BackendServiceDetails): ServiceFeeItem[] | undefined {
  if (!Array.isArray(svc.fees) || svc.fees.length === 0) return undefined;
  return svc.fees.map((f) => ({
    description: f.description ?? null,
    amount: convertToJod(parseFeeAmount(f.amount), f.currency ?? svc.currency ?? 'JOD'),
    currency: 'JOD'
  }));
}

function mapBackendServiceToDomain(svc: BackendServiceDetails): Service {
  const requiredDocuments = Array.isArray(svc.documents)
    ? svc.documents.filter((d) => d.isRequired).map((d) => d.documentName)
    : [];

  const feesBreakdown = mapFeesBreakdown(svc);
  const currency = 'JOD';

  const feesFromBreakdown = feesBreakdown?.reduce((sum, f) => sum + (Number.isFinite(f.amount) ? f.amount : 0), 0);
  const feesRaw = svc.price;
  const parsedPrice = typeof feesRaw === 'number' ? feesRaw : feesRaw != null ? Number(feesRaw) : NaN;
  const hasBreakdown = Array.isArray(feesBreakdown) && feesBreakdown.length > 0;
  const hasPrice = Number.isFinite(parsedPrice);
  const feesFromPriceJod = hasPrice ? convertToJod(parsedPrice, svc.currency ?? 'JOD') : 0;
  const fees = hasBreakdown ? feesFromBreakdown ?? 0 : feesFromPriceJod;

  return {
    id: svc.id,
    name: svc.canonicalName,
    category: '',
    description: svc.description ?? '',
    requiredDocuments,
    feesBreakdown,
    fees: Number.isFinite(fees) ? fees : 0,
    currency,
    feesUnknown: false,
    isEnabled: Boolean(svc.isActive),
  };
}

type BackendServicesListResponse = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  query?: string;
  services: BackendServiceListItem[];
};

export type ServicesPage = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  query: string;
  services: Service[];
};

export async function getServices(args?: {
  page?: number;
  limit?: number;
  query?: string;
}): Promise<ServicesPage> {
  const page = Math.max(1, Number(args?.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(args?.limit ?? 20)));

  const res = await getApiClient().get<BackendServicesListResponse>('/services', {
    params: {
      page,
      limit,
      query: args?.query,
    },
  });

  const list = res.data.services ?? [];
  const mapped = list.map((s) => mapBackendServiceToDomain(s));

  // If the list response doesn't include `price`, hydrate fees via service details.
  const listHasAnyPrice = list.some((s) => s.price != null);
  if (listHasAnyPrice) {
    return {
      page: Number(res.data.page ?? page),
      limit: Number(res.data.limit ?? limit),
      total: Number(res.data.total ?? mapped.length),
      totalPages: Number(res.data.totalPages ?? 1),
      query: String(res.data.query ?? args?.query ?? ''),
      services: mapped,
    };
  }

  const enriched = await Promise.all(
    mapped.map(async (svc) => {
      try {
        const details = await getServiceById(svc.id);
        return {
          ...svc,
          fees: details.fees,
          feesBreakdown: details.feesBreakdown,
          requiredDocuments: details.requiredDocuments,
        };
      } catch {
        return svc;
      }
    })
  );

  return {
    page: Number(res.data.page ?? page),
    limit: Number(res.data.limit ?? limit),
    total: Number(res.data.total ?? enriched.length),
    totalPages: Number(res.data.totalPages ?? 1),
    query: String(res.data.query ?? args?.query ?? ''),
    services: enriched,
  };
}

export async function getServiceById(serviceId: string): Promise<Service> {
  const res = await getApiClient().get<{ service: BackendServiceDetails }>(`/services/${serviceId}`);
  return mapBackendServiceToDomain(res.data.service);
}

export async function getServiceSlots(serviceId: string): Promise<TimeSlot[]> {
  // Not available on backend yet; keep mocked.
  const res = await getMockApiClient().get<TimeSlot[]>(`/services/${serviceId}/slots`);
  return res.data;
}

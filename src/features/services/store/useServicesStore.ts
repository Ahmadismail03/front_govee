import { create } from 'zustand';
import type { Service } from '../../../core/domain/service';
import * as repo from '../api/servicesRepository';
import type { ServiceCategory } from '../api/servicesRepository';
import i18n from '../../../core/i18n/init';

function mergeServicesById(existing: Service[], incoming: Service[]): Service[] {
  const merged = new Map(existing.map((service) => [service.id, service]));

  incoming.forEach((service) => {
    merged.set(service.id, service);
  });

  return Array.from(merged.values());
}

type ServicesState = {
  services: Service[];
  browseServices: Service[];
  categories: ServiceCategory[];
  isLoading: boolean;
  error: string | null;
  search: string;
  category: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  load: () => Promise<void>;
  ensureServicesByIds: (ids: string[]) => Promise<void>;
  setPage: (page: number) => void;
  setSearch: (v: string) => void;
  setCategory: (v: string) => void;
};

export const useServicesStore = create<ServicesState>((set, get) => ({
  services: [],
  browseServices: [],
  categories: [],
  isLoading: false,
  error: null,
  search: '',
  category: 'ALL',
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const { page, limit, search, category } = get();
      const res = await repo.getServices({
        page,
        limit,
        query: search.trim() || undefined,
        category: category === 'ALL' ? undefined : category,
      });
      const nextServices = mergeServicesById(get().services, res.services);
      set({
        services: nextServices,
        browseServices: res.services,
        categories: res.categories,
        page: res.page,
        limit: res.limit,
        total: res.total,
        totalPages: res.totalPages,
        isLoading: false,
      });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? i18n.t('common.errorDesc') });
    }
  },

  ensureServicesByIds: async (ids) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const existingIds = new Set(get().services.map((service) => service.id));
    const missingIds = uniqueIds.filter((id) => !existingIds.has(id));
    if (missingIds.length === 0) return;

    try {
      const loaded = await Promise.all(missingIds.map((id) => repo.getServiceById(id)));
      set((state) => ({
        services: mergeServicesById(state.services, loaded),
      }));
    } catch (e: any) {
      set({ error: e?.message ?? i18n.t('common.errorDesc') });
    }
  },

  setPage: (page) => set({ page: Math.max(1, Math.floor(page || 1)) }),
  setSearch: (v) => set({ search: v, page: 1 }),
  setCategory: (v) => set({ category: v, page: 1 }),
}));

export function selectVisibleServices(state: ServicesState): Service[] {
  const enabled = state.services.filter((s) => s.isEnabled);
  const bySearch = state.search.trim()
    ? enabled.filter((s) => s.name.toLowerCase().includes(state.search.trim().toLowerCase()))
    : enabled;
  if (state.category === 'ALL') return bySearch;
  return bySearch.filter((s) => s.category === state.category);
}

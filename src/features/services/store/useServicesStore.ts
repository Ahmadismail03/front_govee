import { create } from 'zustand';
import type { Service } from '../../../core/domain/service';
import * as repo from '../api/servicesRepository';
import i18n from '../../../core/i18n/init';

type ServicesState = {
  services: Service[];
  isLoading: boolean;
  error: string | null;
  search: string;
  category: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  load: () => Promise<void>;
  setPage: (page: number) => void;
  setSearch: (v: string) => void;
  setCategory: (v: string) => void;
};

export const useServicesStore = create<ServicesState>((set, get) => ({
  services: [],
  isLoading: false,
  error: null,
  search: '',
  category: 'ALL',
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const { page, limit, search } = get();
      const res = await repo.getServices({ page, limit, query: search.trim() || undefined });
      set({
        services: res.services,
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

  setPage: (page) => set({ page: Math.max(1, Math.floor(page || 1)) }),
  setSearch: (v) => set({ search: v, page: 1 }),
  setCategory: (v) => set({ category: v }),
}));

export function selectVisibleServices(state: ServicesState): Service[] {
  const enabled = state.services.filter((s) => s.isEnabled);
  const bySearch = state.search.trim()
    ? enabled.filter((s) => s.name.toLowerCase().includes(state.search.trim().toLowerCase()))
    : enabled;
  if (state.category === 'ALL') return bySearch;
  return bySearch.filter((s) => s.category === state.category);
}

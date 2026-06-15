import { useQuery } from '@tanstack/react-query';
import * as api from '../api/client';

export function useStats() {
  return useQuery({ queryKey: ['stats'], queryFn: api.getStats });
}

export function useGuardCategories() {
  return useQuery({ queryKey: ['guard-categories'], queryFn: api.getGuardCategories });
}

export function useVendors(params?: Parameters<typeof api.getVendors>[0]) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => api.getVendors(params),
  });
}

export function useVendor(id: number) {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: () => api.getVendor(id),
    enabled: id > 0,
  });
}

export function useProducts(params?: Parameters<typeof api.getProducts>[0]) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => api.getProducts(params),
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.getProduct(id),
    enabled: id > 0,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.searchAll(query),
    enabled: query.length >= 2,
  });
}

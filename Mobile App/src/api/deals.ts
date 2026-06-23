import { api } from './client';
import type { Property } from '@/types';

export async function getMySubmissions(): Promise<Property[]> {
  const { data } = await api.get<Property[]>('/deals/my-submissions');
  return data;
}

export async function getDealById(id: string): Promise<Property> {
  const { data } = await api.get<Property>(`/deals/${id}`);
  return data;
}

export async function createDeal(payload: Partial<Property>): Promise<Property> {
  const { data } = await api.post<Property>('/deals', payload);
  return data;
}

export async function updateMyDeal(id: string, payload: Partial<Property>): Promise<Property> {
  const { data } = await api.patch<Property>(`/deals/${id}`, payload);
  return data;
}

export async function unsubmitDeal(id: string): Promise<void> {
  await api.post(`/deals/${id}/unsubmit`);
}

// Backend doesn't expose a hard-delete for submitters — unsubmit is the closest equivalent.
export const deleteMyDeal = unsubmitDeal;

export async function getPublishedDeals(): Promise<Property[]> {
  const { data } = await api.get<Property[]>('/deals/published');
  return data;
}

// ── Claim ("I want this Scholarship House") ──────────────────────────────────
// Marks the property pending and notifies the Scholarship House team.
// Backend: POST /deals/:id/claim (propertyClaimRoutes.js).
export async function claimProperty(id: string): Promise<Property> {
  const { data } = await api.post<Property>(`/deals/${id}/claim`);
  return data;
}

// ── Favorites ──────────────────────────────────────────────────────────────────

export async function getFavorites(): Promise<string[]> {
  const { data } = await api.get<{ favorites: string[] }>('/favorites');
  return data.favorites || [];
}

export async function addFavorite(propertyId: string): Promise<void> {
  await api.post(`/favorites/${propertyId}`);
}

export async function removeFavorite(propertyId: string): Promise<void> {
  await api.delete(`/favorites/${propertyId}`);
}

// ── Buy Box (saved filters) ───────────────────────────────────────────────────

export async function saveBuyBox(filters_json: Record<string, any>): Promise<void> {

  await api.post('/deals/store-filter', { filters_json });
}

export async function deleteBuyBox(): Promise<void> {
  await api.delete('/deals/delete-filter');
}

export async function getBuyBox(): Promise<Record<string, any> | null> {
  try {
    const { data } = await api.get<{ data: { filters_json: Record<string, any> } }>('/deals/get-filter');
    return data?.data?.filters_json ?? null;
  } catch {
    return null;
  }
}

// Client-side "duplicate": fetch a deal, strip server fields, send as a new create.
export async function duplicateDeal(id: string): Promise<Property> {
  const original = await getDealById(id);
  const {
    id: _id,
    status: _status,
    submittedAt: _s,
    createdAt: _c,
    updatedAt: _u,
    ...rest
  } = original;
  return createDeal({ ...rest, title: original.title ? `${original.title} (Copy)` : undefined });
}

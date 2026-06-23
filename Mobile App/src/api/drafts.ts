import { api } from './client';
import type { Draft } from '@/types';

/**
 * Drafts API — mirrors admin/api/deals.js draftsAPI behavior.
 *
 * The backend stores drafts FLAT (no `{ payload: {...} }` wrapping).
 * The submitter's email comes from the JWT, but legacy paths also accept
 * an explicit `submitterEmail` field — we include it for safety.
 */

export async function getMyDrafts(): Promise<Draft[]> {
  // Endpoint historically returns one of:
  //   • a bare array
  //   • `{ drafts: [...] }`
  //   • `{ data: [...] }`
  // Normalize to a plain array no matter which shape comes back.
  const { data } = await api.get('/drafts/mine');
  if (Array.isArray(data)) return data as Draft[];
  if (Array.isArray(data?.drafts)) return data.drafts as Draft[];
  if (Array.isArray(data?.data)) return data.data as Draft[];
  if (Array.isArray(data?.items)) return data.items as Draft[];
  return [];
}

// Backend single-draft responses are wrapped as `{ data: <draft> }`. Older
// shapes also returned the draft directly. Unwrap defensively so callers
// (e.g. handleFormSubmit setDraftId(created.id)) get a clean draft object.
function unwrapDraft(body: any): Draft {
  if (body && typeof body === 'object' && body.data && typeof body.data === 'object') {
    return body.data as Draft;
  }
  return body as Draft;
}

export async function getDraftById(id: string): Promise<Draft> {
  const { data } = await api.get(`/drafts/${id}`);
  return unwrapDraft(data);
}

export async function createDraft(payload: Record<string, unknown>): Promise<Draft> {
  // Flat payload (admin behavior). Do NOT wrap in `{ payload }`.
  const { data } = await api.post('/drafts', payload);
  return unwrapDraft(data);
}

export async function updateDraft(id: string, payload: Record<string, unknown>): Promise<Draft> {
  const { data } = await api.put(`/drafts/${id}`, payload);
  return unwrapDraft(data);
}

export async function deleteDraft(id: string): Promise<void> {
  await api.delete(`/drafts/${id}`);
}

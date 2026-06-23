/**
 * propertyImport.js — API client for the bulk import feature.
 *
 * Mirrors the convention used by drafts.js and dealsAPI: use the shared
 * `api` axios instance, call the mounted route prefix, and unwrap
 * `res.data?.data ?? res.data` so callers get the payload directly.
 *
 * Backend mounts this router at:
 *   app.use('/api/propertyImport', propertyImportRoutes);
 */

import api from './api';

export const propertyImportAPI = {
  /**
   * Server-side parsing fallback. Useful when you'd rather not ship pdfjs
   * to the browser. Currently unused — the modal parses client-side.
   */
  parseOnServer: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/propertyImport/parse', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res?.data?.data ?? res?.data;
  },

  /**
   * Persist the rows the admin selected. Server runs duplicate detection
   * and re-validates every row — never trust the client's `include` flag.
   *
   * @param {Array} rows  Rows from the preview, shaped { id, data, include }.
   * @returns {Promise<{ created, skipped, failed }>}
   */
  commitImport: async (rows) => {
    const payload = rows.filter((r) => r.include).map((r) => r.data);
    const res = await api.post('/propertyImport/commit', {
      properties: payload,
    });
    return res?.data?.data ?? res?.data;
  },
};

export default propertyImportAPI;

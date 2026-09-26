/**
 * Privacy - the consumer's own data (GDPR Art. 20 / Tunisian Law 2004-63).
 *
 * `POST /privacy/data/export` answers with the export itself, not the usual
 * `{ status, data }` envelope: the controller writes the file with `@Res()`,
 * which bypasses the response interceptor. So the payload is `response.data`
 * as-is - `unwrapBackendResponse` would look for an envelope that is not there.
 */

import type { ApiSchemas } from '@foodwaste/shared';

import { apiClient } from '@/services/apiClient';

type DataExportRequest = ApiSchemas['DataExportRequestDto'];

export const privacyService = {
  async exportMyData(): Promise<unknown> {
    const body: DataExportRequest = {
      format: 'json',
      includeActivityData: true,
      includeApplicationData: true,
      legalBasis: 'data_portability',
    };
    const response = await apiClient.post<unknown>('/privacy/data/export', body);
    return response.data;
  },
};

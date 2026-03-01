import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope, MyEstablishment } from '@/types/dashboard';

export type LegalDocumentType =
  | 'business_license'
  | 'food_safety_license'
  | 'insurance_document'
  | 'tax_certificate'
  | 'owner_id_document'
  | 'additional';

const BASE = '/establishments';

export interface UpdateEstablishmentData {
  name?: string;
  description?: string;
  type?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  cuisineTypes?: string[];
  acceptsReservations?: boolean;
  businessHours?: Record<string, { open: string; close: string; closed: boolean }>;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
}

export const establishmentService = {
  /**
   * GET /establishments/my-establishment
   * Fetch the authenticated merchant's own establishment(s).
   * Returns an array; merchants typically have one establishment.
   */
  getMyEstablishment() {
    return apiClient.get<BackendEnvelope<MyEstablishment[]>>(
      `${BASE}/my-establishment`,
    );
  },

  /**
   * PATCH /establishments/:id (JSON)
   * Update editable establishment fields. Ownership is enforced server-side.
   */
  updateEstablishment(id: string, data: UpdateEstablishmentData) {
    return apiClient.patch<BackendEnvelope<MyEstablishment>>(
      `${BASE}/${id}`,
      data,
    );
  },

  /**
   * PATCH /establishments/:id (multipart/form-data)
   * Upload additional photos. Max 8 images total (enforced server-side).
   * Field name must match FilesInterceptor('images', 8) in the controller.
   */
  uploadImages(id: string, files: File[]) {
    const formData = new FormData();
    files.forEach((f) => formData.append('images', f));
    return apiClient.patch<BackendEnvelope<MyEstablishment>>(
      `${BASE}/${id}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  /**
   * POST /establishments/:id/documents
   * Upload a legal document (PDF only). documentType must be a valid DocumentType enum value.
   */
  uploadDocument(
    id: string,
    documentType: LegalDocumentType,
    file: File,
    options?: { expiryDate?: string; notes?: string; additionalType?: string },
  ) {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);
    if (options?.expiryDate) formData.append('expiryDate', options.expiryDate);
    if (options?.notes) formData.append('notes', options.notes);
    if (options?.additionalType) formData.append('additionalType', options.additionalType);
    return apiClient.post<BackendEnvelope<MyEstablishment>>(
      `${BASE}/${id}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  /**
   * DELETE /establishments/:id/documents/:documentType
   * Remove an uploaded legal document.
   */
  deleteDocument(id: string, documentType: LegalDocumentType) {
    return apiClient.delete<BackendEnvelope<MyEstablishment>>(
      `${BASE}/${id}/documents/${documentType}`,
    );
  },
};

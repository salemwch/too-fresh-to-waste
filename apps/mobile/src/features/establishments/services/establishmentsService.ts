/**
 * Establishments Service
 * API client for establishments endpoints
 */

import { apiClient } from '@/services/apiClient';

import type { Establishment } from '../types/establishment.types';

interface EstablishmentResponse {
  message: string;
  data: Establishment;
}

class EstablishmentsService {
  private readonly baseURL = '/establishments';

  /**
   * Get establishment by ID
   */
  async getEstablishment(id: string): Promise<Establishment> {
    const response = await apiClient.get<EstablishmentResponse>(`${this.baseURL}/${id}`);
    return response.data.data;
  }
}

export const establishmentsService = new EstablishmentsService();

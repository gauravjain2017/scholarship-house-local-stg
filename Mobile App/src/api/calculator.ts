import { api } from './client';

export interface CalculatorPayload {
  startYear: number;
  customYears: number[];
  scenarios: Record<string, any>[];
  type: 'simple' | 'advanced';
  client_email?: string;
}

export const calculatorAPI = {
  storeCalculator: (payload: CalculatorPayload) =>
    api.post('/calculators', payload),

  getCalculator: (email: string | undefined, type: 'simple' | 'advanced') =>
    api.get(`/calculators/${email}/${type}`),
};

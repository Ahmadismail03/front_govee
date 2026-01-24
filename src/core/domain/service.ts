export type ServiceFeeItem = {
  description?: string | null;
  amount: number;
  currency?: string | null;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  // Frontend-only placeholder for local images (mock app).
  imageKey?: 'promo_digital' | 'promo_citizen' | 'promo_services';
  requiredDocuments: string[];
  feesBreakdown?: ServiceFeeItem[];
  fees: number;
  currency: string;
  feesUnknown?: boolean;
  isEnabled: boolean;
};

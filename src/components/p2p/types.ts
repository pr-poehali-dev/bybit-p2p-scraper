export interface P2POffer {
  id: string;
  price: number;
  maker: string;
  maker_id: string;
  quantity: number;
  min_amount: number;
  max_amount: number;
  payment_methods: string[];
  side: 'buy' | 'sell';
  completion_rate: number;
  total_orders: number;
  is_merchant: boolean;
  merchant_type: 'gold' | 'silver' | 'bronze' | 'block_trade' | null;
  merchant_badge: string | null;
  is_online: boolean;
  is_triangle: boolean;
  last_logout_time?: string;
  auth_status?: number;
}

export interface PriceChange {
  [key: string]: 'up' | 'down' | null;
}

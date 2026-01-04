import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface P2POffer {
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
  merchant_type: 'verified' | 'block_trade' | null;
  is_online: boolean;
  is_triangle: boolean;
  last_online_time?: number;
}

interface PriceChange {
  [key: string]: 'up' | 'down' | null;
}

const PaymentIcon = ({ method }: { method: string }) => {
  const lower = method.toLowerCase();
  
  if (lower.includes('cash') || lower === 'наличные') {
    return <Icon name="Banknote" size={12} className="text-green-500" />;
  }
  if (lower.includes('mobile') || lower.includes('top-up')) {
    return <Icon name="Smartphone" size={12} className="text-blue-500" />;
  }
  if (lower.includes('bank') || lower.includes('transfer')) {
    return <Icon name="Building2" size={12} className="text-purple-500" />;
  }
  if (lower.includes('deposit')) {
    return <Icon name="Landmark" size={12} className="text-orange-500" />;
  }
  
  if (lower.includes('sber') || lower.includes('сбер')) {
    return <span className="text-[10px] font-bold text-green-600">СБ</span>;
  }
  if (lower.includes('tinkoff') || lower.includes('тинькофф')) {
    return <span className="text-[10px] font-bold text-yellow-500">ТИ</span>;
  }
  if (lower.includes('alfa') || lower.includes('альфа')) {
    return <span className="text-[10px] font-bold text-red-500">АЛ</span>;
  }
  if (lower.includes('raif') || lower.includes('райф')) {
    return <span className="text-[10px] font-bold text-yellow-600">РФ</span>;
  }
  if (lower.includes('vtb') || lower.includes('втб')) {
    return <span className="text-[10px] font-bold text-blue-600">ВТБ</span>;
  }
  
  return <Icon name="CreditCard" size={12} className="text-gray-500" />;
};

const API_URL = 'https://functions.poehali.dev/ea8079f5-9a7d-41e0-9530-698a124a62b8';

const Index = () => {
  const [sellOffers, setSellOffers] = useState<P2POffer[]>([]);
  const [buyOffers, setBuyOffers] = useState<P2POffer[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceChange>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const prevOffersRef = useRef<Map<string, number>>(new Map());

  // Filters
  const [onlyMerchants, setOnlyMerchants] = useState(false);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [noTriangle, setNoTriangle] = useState(false);
  const [minLimit, setMinLimit] = useState<string>('');
  const [maxLimit, setMaxLimit] = useState<string>('');

  const detectPriceChanges = (newOffers: P2POffer[], prevOffers: Map<string, number>) => {
    const changes: PriceChange = {};
    
    newOffers.forEach(offer => {
      const prevPrice = prevOffers.get(offer.id);
      
      if (prevPrice !== undefined && offer.price > prevPrice) {
        changes[offer.id] = 'up';
      } else if (prevPrice !== undefined && offer.price < prevPrice) {
        changes[offer.id] = 'down';
      }
    });

    setPriceChanges(changes);
    
    setTimeout(() => {
      setPriceChanges({});
    }, 3000);

    const newPriceMap = new Map<string, number>();
    newOffers.forEach(offer => {
      newPriceMap.set(offer.id, offer.price);
    });
    prevOffersRef.current = newPriceMap;
  };

  const fetchOffers = async (side: '1' | '0') => {
    try {
      const response = await fetch(`${API_URL}?side=${side}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const newOffers = data.offers || [];
      
      if (side === '1') {
        detectPriceChanges(newOffers, prevOffersRef.current);
        setSellOffers(newOffers);
      } else {
        detectPriceChanges(newOffers, prevOffersRef.current);
        setBuyOffers(newOffers);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch offers:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error instanceof Error ? error.message : 'Не удалось загрузить объявления',
        variant: 'destructive'
      });
    }
  };

  const loadAllOffers = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchOffers('1'),
        fetchOffers('0')
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllOffers();
    const interval = setInterval(() => {
      fetchOffers('1');
      fetchOffers('0');
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredSellOffers = useMemo(() => {
    return sellOffers.filter(offer => {
      if (onlyMerchants && !offer.is_merchant) return false;
      if (onlyOnline && !offer.is_online) return false;
      if (noTriangle && offer.is_triangle) return false;
      
      if (minLimit) {
        const min = parseFloat(minLimit);
        if (!isNaN(min) && offer.min_amount < min) return false;
      }
      
      if (maxLimit) {
        const max = parseFloat(maxLimit);
        if (!isNaN(max) && offer.max_amount > max) return false;
      }
      
      return true;
    });
  }, [sellOffers, onlyMerchants, onlyOnline, noTriangle, minLimit, maxLimit]);

  const filteredBuyOffers = useMemo(() => {
    return buyOffers.filter(offer => {
      if (onlyMerchants && !offer.is_merchant) return false;
      if (onlyOnline && !offer.is_online) return false;
      if (noTriangle && offer.is_triangle) return false;
      
      if (minLimit) {
        const min = parseFloat(minLimit);
        if (!isNaN(min) && offer.min_amount < min) return false;
      }
      
      if (maxLimit) {
        const max = parseFloat(maxLimit);
        if (!isNaN(max) && offer.max_amount > max) return false;
      }
      
      return true;
    });
  }, [buyOffers, onlyMerchants, onlyOnline, noTriangle, minLimit, maxLimit]);

  const currentOffers = [...filteredSellOffers, ...filteredBuyOffers];
  const avgPrice = currentOffers.length > 0
    ? currentOffers.reduce((sum, o) => sum + o.price, 0) / currentOffers.length
    : 0;

  const merchantCount = currentOffers.filter(o => o.is_merchant).length;
  const verifiedCount = currentOffers.filter(o => o.merchant_type === 'verified').length;
  const blockTradeCount = currentOffers.filter(o => o.merchant_type === 'block_trade').length;
  const onlineCount = currentOffers.filter(o => o.is_online).length;
  const triangleCount = currentOffers.filter(o => o.is_triangle).length;

  const getPriceChangeClass = (offerId: string) => {
    const change = priceChanges[offerId];
    if (change === 'up') return 'bg-success/10';
    if (change === 'down') return 'bg-destructive/10';
    return '';
  };

  return (
    <div className="min-h-screen bg-background p-1">
      <div className="max-w-[2000px] mx-auto space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Icon name="TrendingUp" size={24} className="text-primary" />
            Bybit P2P — USDT/RUB
          </h1>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-primary animate-pulse' : 'bg-success'}`} />
                {lastUpdate.toLocaleTimeString('ru-RU')}
              </div>
            )}
            <Button 
              onClick={loadAllOffers}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
            >
              <Icon name="RefreshCw" size={12} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-7 gap-1.5">
          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Средняя</div>
              <div className="text-base font-bold text-foreground">{avgPrice.toFixed(2)} ₽</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Всего</div>
              <div className="text-base font-bold text-foreground">{currentOffers.length}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-0.5">
                <Icon name="BadgeCheck" size={10} /> Мерч.
              </div>
              <div className="text-base font-bold text-primary">{merchantCount}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-0.5">
                <Icon name="ShieldCheck" size={10} /> Пров.
              </div>
              <div className="text-base font-bold text-green-500">{verifiedCount}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-0.5">
                <Icon name="Blocks" size={10} /> Блок
              </div>
              <div className="text-base font-bold text-blue-500">{blockTradeCount}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-0.5">
                <Icon name="Wifi" size={10} /> Онлайн
              </div>
              <div className="text-base font-bold text-success">{onlineCount}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="text-[10px] text-muted-foreground mb-0.5">Треугол</div>
              <div className="text-base font-bold text-yellow-500">{triangleCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-2">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="flex items-center space-x-1.5">
                <Switch id="merchants" checked={onlyMerchants} onCheckedChange={setOnlyMerchants} className="scale-75" />
                <Label htmlFor="merchants" className="text-[10px] cursor-pointer">Только мерчанты</Label>
              </div>
              
              <div className="flex items-center space-x-1.5">
                <Switch id="online" checked={onlyOnline} onCheckedChange={setOnlyOnline} className="scale-75" />
                <Label htmlFor="online" className="text-[10px] cursor-pointer">Только онлайн</Label>
              </div>
              
              <div className="flex items-center space-x-1.5">
                <Switch id="notriangle" checked={noTriangle} onCheckedChange={setNoTriangle} className="scale-75" />
                <Label htmlFor="notriangle" className="text-[10px] cursor-pointer">Без треугол</Label>
              </div>

              <div className="space-y-0.5">
                <Label htmlFor="minLimit" className="text-[10px]">Мин. лимит</Label>
                <Input 
                  id="minLimit" 
                  type="number" 
                  placeholder="0"
                  value={minLimit}
                  onChange={(e) => setMinLimit(e.target.value)}
                  className="h-6 text-[10px] px-2"
                />
              </div>

              <div className="space-y-0.5">
                <Label htmlFor="maxLimit" className="text-[10px]">Макс. лимит</Label>
                <Input 
                  id="maxLimit" 
                  type="number" 
                  placeholder="∞"
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(e.target.value)}
                  className="h-6 text-[10px] px-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="TrendingDown" size={14} className="text-sell" />
                <span className="text-xs font-semibold">Продажа ({sellOffers.filter(o => {
                  if (onlyMerchants && !o.is_merchant) return false;
                  if (onlyOnline && !o.is_online) return false;
                  if (noTriangle && o.is_triangle) return false;
                  if (minLimit && o.min_amount < parseFloat(minLimit)) return false;
                  if (maxLimit && o.max_amount > parseFloat(maxLimit)) return false;
                  return true;
                }).length})</span>
              </div>
              {isLoading && sellOffers.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <Icon name="Loader2" size={24} className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground w-6">#</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Цена</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Трейдер</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">USDT</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Лимиты</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Опл</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Сд</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellOffers.filter(offer => {
                        if (onlyMerchants && !offer.is_merchant) return false;
                        if (onlyOnline && !offer.is_online) return false;
                        if (noTriangle && offer.is_triangle) return false;
                        if (minLimit) {
                          const min = parseFloat(minLimit);
                          if (!isNaN(min) && offer.min_amount < min) return false;
                        }
                        if (maxLimit) {
                          const max = parseFloat(maxLimit);
                          if (!isNaN(max) && offer.max_amount > max) return false;
                        }
                        return true;
                      }).map((offer, idx) => (
                        <tr 
                          key={offer.id} 
                          className={`${(idx + 1) % 10 === 0 ? 'border-b border-border' : ''} hover:bg-secondary/30 transition-all duration-300 bg-sell ${getPriceChangeClass(offer.id)}`}
                        >
                          <td className="py-0.5 px-1 text-muted-foreground text-[9px]">{idx + 1}</td>
                          <td className="py-0.5 px-1 font-bold text-sell">
                            <div className="flex items-center gap-0.5">
                              {offer.price.toFixed(2)}
                              {priceChanges[offer.id] === 'up' && (
                                <Icon name="ArrowUp" size={9} className="text-success" />
                              )}
                              {priceChanges[offer.id] === 'down' && (
                                <Icon name="ArrowDown" size={9} className="text-destructive" />
                              )}
                            </div>
                          </td>
                          <td className="py-0.5 px-1">
                            <div className="flex items-center gap-0.5">
                              {offer.is_online && (
                                <div className="w-1 h-1 rounded-full bg-success flex-shrink-0" />
                              )}
                              <span 
                                className="font-semibold text-foreground truncate max-w-[80px]"
                                title={`ID: ${offer.maker_id}`}
                              >
                                {offer.maker}
                              </span>
                              {offer.merchant_type === 'verified' && (
                                <Icon name="ShieldCheck" size={9} className="text-green-500 flex-shrink-0" title="Проверенный мерчант" />
                              )}
                              {offer.merchant_type === 'block_trade' && (
                                <Icon name="Blocks" size={9} className="text-blue-500 flex-shrink-0" title="Мерчант блочной торговли" />
                              )}
                              {offer.is_triangle && (
                                <span className="text-yellow-500 text-[8px] flex-shrink-0" title="Треугольник">△</span>
                              )}
                            </div>
                          </td>
                          <td className="py-0.5 px-1 text-foreground font-medium">
                            {offer.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-0.5 px-1 text-muted-foreground text-[9px]">
                            {offer.min_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}-{offer.max_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-0.5 px-1">
                            <div className="flex items-center gap-0.5">
                              {offer.payment_methods.length > 0 ? (
                                offer.payment_methods.slice(0, 3).map((method, mIdx) => (
                                  <div key={mIdx} title={method}>
                                    <PaymentIcon method={method} />
                                  </div>
                                ))
                              ) : (
                                <span className="text-[9px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-0.5 px-1">
                            <div className="flex flex-col leading-none">
                              <span className="text-foreground font-medium text-[9px]">{offer.completion_rate.toFixed(0)}</span>
                              <span className="text-[8px] text-muted-foreground">{offer.total_orders}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sellOffers.filter(offer => {
                    if (onlyMerchants && !offer.is_merchant) return false;
                    if (onlyOnline && !offer.is_online) return false;
                    if (noTriangle && offer.is_triangle) return false;
                    if (minLimit && offer.min_amount < parseFloat(minLimit)) return false;
                    if (maxLimit && offer.max_amount > parseFloat(maxLimit)) return false;
                    return true;
                  }).length === 0 && !isLoading && (
                    <div className="text-center py-4">
                      <Icon name="SearchX" size={24} className="mx-auto text-muted-foreground mb-1" />
                      <p className="text-[10px] text-muted-foreground">Нет объявлений</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-2">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="TrendingUp" size={14} className="text-buy" />
                <span className="text-xs font-semibold">Покупка ({buyOffers.filter(o => {
                  if (onlyMerchants && !o.is_merchant) return false;
                  if (onlyOnline && !o.is_online) return false;
                  if (noTriangle && o.is_triangle) return false;
                  if (minLimit && o.min_amount < parseFloat(minLimit)) return false;
                  if (maxLimit && o.max_amount > parseFloat(maxLimit)) return false;
                  return true;
                }).length})</span>
              </div>
              {isLoading && buyOffers.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <Icon name="Loader2" size={24} className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground w-6">#</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Цена</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Трейдер</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">USDT</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Лимиты</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Опл</th>
                        <th className="text-left py-1 px-1 font-semibold text-muted-foreground">Сд</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyOffers.filter(offer => {
                        if (onlyMerchants && !offer.is_merchant) return false;
                        if (onlyOnline && !offer.is_online) return false;
                        if (noTriangle && offer.is_triangle) return false;
                        if (minLimit) {
                          const min = parseFloat(minLimit);
                          if (!isNaN(min) && offer.min_amount < min) return false;
                        }
                        if (maxLimit) {
                          const max = parseFloat(maxLimit);
                          if (!isNaN(max) && offer.max_amount > max) return false;
                        }
                        return true;
                      }).map((offer, idx) => (
                        <tr 
                          key={offer.id} 
                          className={`${(idx + 1) % 10 === 0 ? 'border-b border-border' : ''} hover:bg-secondary/30 transition-all duration-300 bg-buy ${getPriceChangeClass(offer.id)}`}
                        >
                          <td className="py-0.5 px-1 text-muted-foreground text-[9px]">{idx + 1}</td>
                          <td className="py-0.5 px-1 font-bold text-buy">
                            <div className="flex items-center gap-0.5">
                              {offer.price.toFixed(2)}
                              {priceChanges[offer.id] === 'up' && (
                                <Icon name="ArrowUp" size={9} className="text-success" />
                              )}
                              {priceChanges[offer.id] === 'down' && (
                                <Icon name="ArrowDown" size={9} className="text-destructive" />
                              )}
                            </div>
                          </td>
                          <td className="py-0.5 px-1">
                            <div className="flex items-center gap-0.5">
                              {offer.is_online && (
                                <div className="w-1 h-1 rounded-full bg-success flex-shrink-0" />
                              )}
                              <span 
                                className="font-semibold text-foreground truncate max-w-[80px]"
                                title={`ID: ${offer.maker_id}`}
                              >
                                {offer.maker}
                              </span>
                              {offer.merchant_type === 'verified' && (
                                <Icon name="ShieldCheck" size={9} className="text-green-500 flex-shrink-0" title="Проверенный мерчант" />
                              )}
                              {offer.merchant_type === 'block_trade' && (
                                <Icon name="Blocks" size={9} className="text-blue-500 flex-shrink-0" title="Мерчант блочной торговли" />
                              )}
                              {offer.is_triangle && (
                                <span className="text-yellow-500 text-[8px] flex-shrink-0" title="Треугольник">△</span>
                              )}
                            </div>
                          </td>
                          <td className="py-0.5 px-1 text-foreground font-medium">
                            {offer.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-0.5 px-1 text-muted-foreground text-[9px]">
                            {offer.min_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}-{offer.max_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-0.5 px-1">
                            <div className="flex items-center gap-0.5">
                              {offer.payment_methods.length > 0 ? (
                                offer.payment_methods.slice(0, 3).map((method, mIdx) => (
                                  <div key={mIdx} title={method}>
                                    <PaymentIcon method={method} />
                                  </div>
                                ))
                              ) : (
                                <span className="text-[9px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-0.5 px-1">
                            <div className="flex flex-col leading-none">
                              <span className="text-foreground font-medium text-[9px]">{offer.completion_rate.toFixed(0)}</span>
                              <span className="text-[8px] text-muted-foreground">{offer.total_orders}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {buyOffers.filter(offer => {
                    if (onlyMerchants && !offer.is_merchant) return false;
                    if (onlyOnline && !offer.is_online) return false;
                    if (noTriangle && offer.is_triangle) return false;
                    if (minLimit && offer.min_amount < parseFloat(minLimit)) return false;
                    if (maxLimit && offer.max_amount > parseFloat(maxLimit)) return false;
                    return true;
                  }).length === 0 && !isLoading && (
                    <div className="text-center py-4">
                      <Icon name="SearchX" size={24} className="mx-auto text-muted-foreground mb-1" />
                      <p className="text-[10px] text-muted-foreground">Нет объявлений</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
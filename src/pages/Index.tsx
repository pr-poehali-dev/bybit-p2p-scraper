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
  is_online: boolean;
  is_triangle: boolean;
}

interface PriceChange {
  [key: string]: 'up' | 'down' | 'new' | null;
}

const API_URL = 'https://functions.poehali.dev/ea8079f5-9a7d-41e0-9530-698a124a62b8';

const Index = () => {
  const [sellOffers, setSellOffers] = useState<P2POffer[]>([]);
  const [buyOffers, setBuyOffers] = useState<P2POffer[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceChange>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const prevOffersRef = useRef<Map<string, number>>(new Map());
  const seenOfferIdsRef = useRef<Set<string>>(new Set());

  // Filters
  const [onlyMerchants, setOnlyMerchants] = useState(false);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [onlyTriangle, setOnlyTriangle] = useState(false);
  const [minLimit, setMinLimit] = useState<string>('');
  const [maxLimit, setMaxLimit] = useState<string>('');

  const detectPriceChanges = (newOffers: P2POffer[], prevOffers: Map<string, number>) => {
    const changes: PriceChange = {};
    
    newOffers.forEach(offer => {
      const prevPrice = prevOffers.get(offer.id);
      const wasSeen = seenOfferIdsRef.current.has(offer.id);
      
      if (prevPrice === undefined && wasSeen) {
        changes[offer.id] = 'new';
      } else if (prevPrice !== undefined && offer.price > prevPrice) {
        changes[offer.id] = 'up';
      } else if (prevPrice !== undefined && offer.price < prevPrice) {
        changes[offer.id] = 'down';
      }
      
      seenOfferIdsRef.current.add(offer.id);
    });

    setPriceChanges(changes);
    
    setTimeout(() => {
      setPriceChanges({});
    }, 2000);

    const newPriceMap = new Map<string, number>();
    newOffers.forEach(offer => {
      newPriceMap.set(offer.id, offer.price);
    });
    prevOffersRef.current = newPriceMap;
  };

  const fetchOffers = async (side: '1' | '0') => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllOffers = async () => {
    await Promise.all([
      fetchOffers('1'),
      fetchOffers('0')
    ]);
  };

  useEffect(() => {
    loadAllOffers();
    const interval = setInterval(loadAllOffers, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredOffers = useMemo(() => {
    const offers = activeTab === 'sell' ? sellOffers : buyOffers;
    
    return offers.filter(offer => {
      if (onlyMerchants && !offer.is_merchant) return false;
      if (onlyOnline && !offer.is_online) return false;
      if (onlyTriangle && !offer.is_triangle) return false;
      
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
  }, [sellOffers, buyOffers, activeTab, onlyMerchants, onlyOnline, onlyTriangle, minLimit, maxLimit]);

  const currentOffers = filteredOffers;
  const avgPrice = currentOffers.length > 0
    ? currentOffers.reduce((sum, o) => sum + o.price, 0) / currentOffers.length
    : 0;

  const merchantCount = currentOffers.filter(o => o.is_merchant).length;
  const onlineCount = currentOffers.filter(o => o.is_online).length;
  const triangleCount = currentOffers.filter(o => o.is_triangle).length;

  const getPriceChangeClass = (offerId: string) => {
    const change = priceChanges[offerId];
    if (change === 'up') return 'animate-pulse-glow bg-success/20';
    if (change === 'down') return 'animate-pulse-glow bg-destructive/20';
    if (change === 'new') return 'animate-fade-in bg-primary/20';
    return '';
  };

  return (
    <div className="min-h-screen bg-background p-2 md:p-4">
      <div className="max-w-[1800px] mx-auto space-y-3 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Icon name="TrendingUp" size={28} className="text-primary" />
              Bybit P2P — USDT/RUB
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-primary animate-pulse' : 'bg-success'}`} />
                {lastUpdate.toLocaleTimeString('ru-RU')}
              </div>
            )}
            <Button 
              onClick={loadAllOffers}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <Icon name="RefreshCw" size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Средняя цена</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold text-foreground">{avgPrice.toFixed(2)} ₽</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Всего</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold text-foreground">{currentOffers.length}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Мерчанты</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold text-primary">{merchantCount}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Онлайн</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold text-success">{onlineCount}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Треугол</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold text-foreground">{triangleCount}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Продажа/Покупка</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold">
                <span className="text-sell">{sellOffers.length}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-buy">{buyOffers.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icon name="Filter" size={16} />
              Фильтры
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center space-x-2">
                <Switch id="merchants" checked={onlyMerchants} onCheckedChange={setOnlyMerchants} />
                <Label htmlFor="merchants" className="text-xs cursor-pointer">Только мерчанты</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="online" checked={onlyOnline} onCheckedChange={setOnlyOnline} />
                <Label htmlFor="online" className="text-xs cursor-pointer">Только онлайн</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="triangle" checked={onlyTriangle} onCheckedChange={setOnlyTriangle} />
                <Label htmlFor="triangle" className="text-xs cursor-pointer">Только треугол</Label>
              </div>

              <div className="space-y-1">
                <Label htmlFor="minLimit" className="text-xs">Мин. лимит (₽)</Label>
                <Input 
                  id="minLimit" 
                  type="number" 
                  placeholder="0"
                  value={minLimit}
                  onChange={(e) => setMinLimit(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="maxLimit" className="text-xs">Макс. лимит (₽)</Label>
                <Input 
                  id="maxLimit" 
                  type="number" 
                  placeholder="∞"
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icon name="BookOpen" size={16} />
              Все объявления
              <Badge variant="outline" className="ml-auto text-xs">
                <Icon name="Zap" size={10} className="mr-1" />
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sell' | 'buy')}>
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-3 h-8">
                <TabsTrigger value="sell" className="data-[state=active]:bg-destructive/20 text-xs">
                  <Icon name="TrendingDown" size={14} className="mr-1 text-sell" />
                  Продажа ({sellOffers.length})
                </TabsTrigger>
                <TabsTrigger value="buy" className="data-[state=active]:bg-success/20 text-xs">
                  <Icon name="TrendingUp" size={14} className="mr-1 text-buy" />
                  Покупка ({buyOffers.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {isLoading && currentOffers.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Icon name="Loader2" size={28} className="animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Цена</th>
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Трейдер</th>
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground">USDT</th>
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Лимиты (₽)</th>
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Оплата</th>
                          <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Сделок</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentOffers.map((offer) => (
                          <tr 
                            key={offer.id} 
                            className={`border-b border-border hover:bg-secondary/50 transition-all duration-300 ${
                              offer.side === 'sell' ? 'bg-sell' : 'bg-buy'
                            } ${getPriceChangeClass(offer.id)}`}
                          >
                            <td className={`py-2 px-2 font-bold text-base transition-all duration-300 ${offer.side === 'sell' ? 'text-sell' : 'text-buy'}`}>
                              <div className="flex items-center gap-1">
                                {offer.price.toFixed(2)} ₽
                                {priceChanges[offer.id] === 'up' && (
                                  <Icon name="TrendingUp" size={12} className="text-success animate-fade-in" />
                                )}
                                {priceChanges[offer.id] === 'down' && (
                                  <Icon name="TrendingDown" size={12} className="text-destructive animate-fade-in" />
                                )}
                                {priceChanges[offer.id] === 'new' && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 animate-fade-in">NEW</Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1">
                                    {offer.is_online && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-success" title="Онлайн" />
                                    )}
                                    <span className="font-semibold text-foreground">{offer.maker}</span>
                                    {offer.is_merchant && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-primary/20 text-primary border-primary/30">
                                        <Icon name="BadgeCheck" size={10} className="mr-0.5" />
                                        M
                                      </Badge>
                                    )}
                                    {offer.is_triangle && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500/50 text-yellow-500">
                                        △
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">ID: {offer.maker_id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-foreground font-medium">
                              {offer.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground">
                              {offer.min_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} - {offer.max_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex flex-wrap gap-0.5">
                                {offer.payment_methods.length > 0 ? (
                                  offer.payment_methods.slice(0, 2).map((method, idx) => (
                                    <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0">
                                      {method}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                                {offer.payment_methods.length > 2 && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    +{offer.payment_methods.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex flex-col">
                                <span className="text-foreground font-medium">{offer.completion_rate.toFixed(0)}</span>
                                <span className="text-[10px] text-muted-foreground">{offer.total_orders}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {currentOffers.length === 0 && !isLoading && (
                      <div className="text-center py-8">
                        <Icon name="SearchX" size={36} className="mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">Объявления не найдены</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;

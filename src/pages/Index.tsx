import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';

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
}

const API_URL = 'https://functions.poehali.dev/ea8079f5-9a7d-41e0-9530-698a124a62b8';

const Index = () => {
  const [sellOffers, setSellOffers] = useState<P2POffer[]>([]);
  const [buyOffers, setBuyOffers] = useState<P2POffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');

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
      
      if (side === '1') {
        setSellOffers(data.offers || []);
      } else {
        setBuyOffers(data.offers || []);
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
    const interval = setInterval(loadAllOffers, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentOffers = activeTab === 'sell' ? sellOffers : buyOffers;
  const avgPrice = currentOffers.length > 0
    ? currentOffers.reduce((sum, o) => sum + o.price, 0) / currentOffers.length
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center gap-3">
              <Icon name="TrendingUp" size={36} className="text-primary" />
              Bybit P2P — USDT/RUB
            </h1>
            <p className="text-muted-foreground mt-1">Все объявления с реальными данными</p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Clock" size={16} />
                  {lastUpdate.toLocaleTimeString('ru-RU')}
                </div>
              </div>
            )}
            <Button 
              onClick={loadAllOffers}
              disabled={isLoading}
              variant="outline"
            >
              <Icon name="RefreshCw" size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Средняя цена</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{avgPrice.toFixed(2)} ₽</div>
              <p className="text-xs text-muted-foreground mt-1">за 1 USDT</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Объявлений продажи</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-sell">{sellOffers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">активных предложений</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Объявлений покупки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-buy">{buyOffers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">активных предложений</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="BookOpen" size={20} />
              Все объявления
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sell' | 'buy')}>
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="sell" className="data-[state=active]:bg-destructive/20">
                  <Icon name="TrendingDown" size={16} className="mr-2 text-sell" />
                  Продажа ({sellOffers.length})
                </TabsTrigger>
                <TabsTrigger value="buy" className="data-[state=active]:bg-success/20">
                  <Icon name="TrendingUp" size={16} className="mr-2 text-buy" />
                  Покупка ({buyOffers.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {isLoading && currentOffers.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Icon name="Loader2" size={32} className="animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Цена</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Трейдер</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Количество USDT</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Лимиты (₽)</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Способы оплаты</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Сделок</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentOffers.map((offer) => (
                          <tr 
                            key={offer.id} 
                            className={`border-b border-border hover:bg-secondary/50 transition-colors ${
                              offer.side === 'sell' ? 'bg-sell' : 'bg-buy'
                            }`}
                          >
                            <td className={`py-3 px-4 font-bold text-xl ${offer.side === 'sell' ? 'text-sell' : 'text-buy'}`}>
                              {offer.price.toFixed(2)} ₽
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground">{offer.maker}</span>
                                <span className="text-xs text-muted-foreground">ID: {offer.maker_id}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-foreground font-medium">
                              {offer.quantity.toLocaleString()} USDT
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {offer.min_amount.toLocaleString()} - {offer.max_amount.toLocaleString()} ₽
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {offer.payment_methods.length > 0 ? (
                                  offer.payment_methods.map((method, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {method}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">Не указаны</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col text-sm">
                                <span className="text-foreground font-medium">{offer.completion_rate.toFixed(0)}</span>
                                <span className="text-xs text-muted-foreground">{offer.total_orders}% завершено</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {currentOffers.length === 0 && !isLoading && (
                      <div className="text-center py-12">
                        <Icon name="SearchX" size={48} className="mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Объявления не найдены</p>
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

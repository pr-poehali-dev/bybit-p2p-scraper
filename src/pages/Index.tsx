import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface P2POffer {
  id: string;
  price: number;
  maker: string;
  volume: string;
  type: 'buy' | 'sell';
  paymentMethods: string[];
  minLimit: number;
  maxLimit: number;
}

const generateMockOffers = (): P2POffer[] => {
  const basePrice = 95.5;
  const offers: P2POffer[] = [];
  
  for (let i = 0; i < 15; i++) {
    const isSell = i < 8;
    const priceVariation = isSell ? (i * 0.15) : -(i - 8) * 0.12;
    
    offers.push({
      id: `offer-${i}`,
      price: Number((basePrice + priceVariation).toFixed(2)),
      maker: `User${Math.floor(Math.random() * 9999)}`,
      volume: `${Math.floor(Math.random() * 50000 + 10000)} - ${Math.floor(Math.random() * 100000 + 50000)}`,
      type: isSell ? 'sell' : 'buy',
      paymentMethods: ['Tinkoff', 'Sber', 'Raiffeisen'].slice(0, Math.floor(Math.random() * 2) + 1),
      minLimit: Math.floor(Math.random() * 5000 + 1000),
      maxLimit: Math.floor(Math.random() * 50000 + 20000)
    });
  }
  
  return offers.sort((a, b) => b.price - a.price);
};

const generatePriceHistory = () => {
  const now = Date.now();
  const data = [];
  const basePrice = 95.5;
  
  for (let i = 30; i >= 0; i--) {
    const timestamp = now - i * 60000;
    const variation = (Math.random() - 0.5) * 1.5;
    data.push({
      time: new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      price: Number((basePrice + variation).toFixed(2)),
      spread: Number((Math.random() * 0.5 + 0.2).toFixed(2))
    });
  }
  
  return data;
};

const Index = () => {
  const [offers, setOffers] = useState<P2POffer[]>(generateMockOffers());
  const [priceHistory, setPriceHistory] = useState(generatePriceHistory());
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [anomalyDetected, setAnomalyDetected] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsUpdating(true);
      
      setTimeout(() => {
        const newOffers = generateMockOffers();
        setOffers(newOffers);
        
        const newHistory = [...priceHistory.slice(1), {
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          price: newOffers[7]?.price || 95.5,
          spread: Number((Math.random() * 0.5 + 0.2).toFixed(2))
        }];
        setPriceHistory(newHistory);
        
        const avgPrice = newOffers.reduce((sum, o) => sum + o.price, 0) / newOffers.length;
        const hasAnomaly = newOffers.some(o => Math.abs(o.price - avgPrice) > 2);
        setAnomalyDetected(hasAnomaly);
        
        setLastUpdate(new Date());
        setIsUpdating(false);
      }, 500);
    }, 30000);

    return () => clearInterval(interval);
  }, [priceHistory]);

  const avgPrice = offers.reduce((sum, o) => sum + o.price, 0) / offers.length;
  const spread = Math.max(...offers.map(o => o.price)) - Math.min(...offers.map(o => o.price));
  const buyOffers = offers.filter(o => o.type === 'buy');
  const sellOffers = offers.filter(o => o.type === 'sell');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center gap-3">
              <Icon name="TrendingUp" size={36} className="text-primary" />
              Bybit P2P Monitor
            </h1>
            <p className="text-muted-foreground mt-1">USDT/RUB Real-time orderbook</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Clock" size={16} />
              Обновлено: {lastUpdate.toLocaleTimeString('ru-RU')}
            </div>
            {isUpdating && (
              <Badge variant="outline" className="mt-2 animate-pulse-glow">
                <Icon name="RefreshCw" size={12} className="mr-1" />
                Обновление...
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Средний курс</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{avgPrice.toFixed(2)} ₽</div>
              <p className="text-xs text-muted-foreground mt-1">за 1 USDT</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Спред</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{spread.toFixed(2)} ₽</div>
              <p className="text-xs text-muted-foreground mt-1">{((spread / avgPrice) * 100).toFixed(2)}% от курса</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Продажа (лучшая)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-sell">{sellOffers[0]?.price.toFixed(2)} ₽</div>
              <p className="text-xs text-muted-foreground mt-1">{sellOffers.length} предложений</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Покупка (лучшая)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-buy">{buyOffers[0]?.price.toFixed(2)} ₽</div>
              <p className="text-xs text-muted-foreground mt-1">{buyOffers.length} предложений</p>
            </CardContent>
          </Card>
        </div>

        {anomalyDetected && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Icon name="AlertTriangle" size={24} className="text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Обнаружена аномалия цен</p>
                  <p className="text-sm text-muted-foreground">Отклонение от среднего курса превышает 2 рубля</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="LineChart" size={20} />
              История изменения курса
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={priceHistory}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="BookOpen" size={20} />
              P2P Стакан
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Тип</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Цена</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Мейкер</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Объем (₽)</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Способы оплаты</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Лимиты (₽)</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr 
                      key={offer.id} 
                      className={`border-b border-border hover:bg-secondary/50 transition-colors ${
                        offer.type === 'sell' ? 'bg-sell' : 'bg-buy'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <Badge variant={offer.type === 'sell' ? 'destructive' : 'default'} className="font-medium">
                          {offer.type === 'sell' ? 'Продажа' : 'Покупка'}
                        </Badge>
                      </td>
                      <td className={`py-3 px-4 font-bold text-lg ${offer.type === 'sell' ? 'text-sell' : 'text-buy'}`}>
                        {offer.price.toFixed(2)} ₽
                      </td>
                      <td className="py-3 px-4 text-foreground">{offer.maker}</td>
                      <td className="py-3 px-4 text-muted-foreground">{offer.volume}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {offer.paymentMethods.map((method) => (
                            <Badge key={method} variant="outline" className="text-xs">
                              {method}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {offer.minLimit.toLocaleString()} - {offer.maxLimit.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="BarChart3" size={20} />
              Спред по времени
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line type="monotone" dataKey="spread" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;

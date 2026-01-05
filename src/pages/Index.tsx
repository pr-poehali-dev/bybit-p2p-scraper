import { useState, useEffect, useRef, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { P2POffer, PriceChange } from '@/components/p2p/types';
import { StatisticsCards } from '@/components/p2p/StatisticsCards';
import { FiltersPanel } from '@/components/p2p/FiltersPanel';
import { OrderbookTable } from '@/components/p2p/OrderbookTable';

const API_URL = 'https://functions.poehali.dev/ea8079f5-9a7d-41e0-9530-698a124a62b8';

const Index = () => {
  const [sellOffers, setSellOffers] = useState<P2POffer[]>([]);
  const [buyOffers, setBuyOffers] = useState<P2POffer[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceChange>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [proxyStats, setProxyStats] = useState<any>(null);

  const prevOffersRef = useRef<Map<string, number>>(new Map());

  const [onlyMerchants, setOnlyMerchants] = useState(false);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [noTriangle, setNoTriangle] = useState(false);
  const [amountLimit, setAmountLimit] = useState<string>('');

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

  const fetchOffers = async (side: '1' | '0', silent = false) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${API_URL}?side=${side}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Превышен лимит запросов. Повторите попытку через минуту.');
        }
        if (response.status === 504 || response.status === 502) {
          throw new Error('Сервер недоступен. Попробуйте позже.');
        }
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
      
      // Сохраняем статистику прокси (если есть)
      if (data.proxy_stats) {
        setProxyStats(data.proxy_stats);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch offers:', error);
      if (!silent) {
        let errorMessage = 'Не удалось загрузить объявления';
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMessage = 'Превышено время ожидания. API Bybit может быть перегружен.';
          } else {
            errorMessage = error.message;
          }
        }
        toast({
          title: 'Ошибка загрузки',
          description: errorMessage,
          variant: 'destructive'
        });
      }
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
    
    // Автообновление каждые 10 минут
    const intervalId = setInterval(() => {
      loadAllOffers();
    }, 10 * 60 * 1000); // 10 минут в миллисекундах
    
    return () => clearInterval(intervalId);
  }, []);

  const filteredSellOffers = useMemo(() => {
    return sellOffers.filter(offer => {
      if (onlyMerchants && !offer.is_merchant) return false;
      if (onlyOnline && !offer.is_online) return false;
      if (noTriangle && offer.is_triangle) return false;
      
      if (amountLimit) {
        const amount = parseFloat(amountLimit);
        if (!isNaN(amount)) {
          if (amount < offer.min_amount || amount > offer.max_amount) return false;
        }
      }
      
      return true;
    });
  }, [sellOffers, onlyMerchants, onlyOnline, noTriangle, amountLimit]);

  const filteredBuyOffers = useMemo(() => {
    return buyOffers.filter(offer => {
      if (onlyMerchants && !offer.is_merchant) return false;
      if (onlyOnline && !offer.is_online) return false;
      if (noTriangle && offer.is_triangle) return false;
      
      if (amountLimit) {
        const amount = parseFloat(amountLimit);
        if (!isNaN(amount)) {
          if (amount < offer.min_amount || amount > offer.max_amount) return false;
        }
      }
      
      return true;
    });
  }, [buyOffers, onlyMerchants, onlyOnline, noTriangle, amountLimit]);

  const currentOffers = [...filteredSellOffers, ...filteredBuyOffers];
  const avgPrice = currentOffers.length > 0
    ? currentOffers.reduce((sum, o) => sum + o.price, 0) / currentOffers.length
    : 0;

  const merchantCount = currentOffers.filter(o => o.is_merchant).length;
  const goldCount = currentOffers.filter(o => o.merchant_type === 'gold').length;
  const silverCount = currentOffers.filter(o => o.merchant_type === 'silver').length;
  const bronzeCount = currentOffers.filter(o => o.merchant_type === 'bronze').length;
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
                {proxyStats && proxyStats.success_rate && (
                  <span className="ml-2 text-[9px] opacity-60" title="Proxy Success Rate">
                    🔒 {proxyStats.success_rate.toFixed(0)}%
                  </span>
                )}
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

        <StatisticsCards
          avgPrice={avgPrice}
          totalOffers={currentOffers.length}
          merchantCount={merchantCount}
          goldCount={goldCount}
          silverCount={silverCount}
          bronzeCount={bronzeCount}
          blockTradeCount={blockTradeCount}
          onlineCount={onlineCount}
          triangleCount={triangleCount}
        />

        <FiltersPanel
          onlyMerchants={onlyMerchants}
          setOnlyMerchants={setOnlyMerchants}
          onlyOnline={onlyOnline}
          setOnlyOnline={setOnlyOnline}
          noTriangle={noTriangle}
          setNoTriangle={setNoTriangle}
          amountLimit={amountLimit}
          setAmountLimit={setAmountLimit}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <OrderbookTable
            title="Продажа"
            icon="TrendingDown"
            iconClass="text-sell"
            offers={filteredSellOffers}
            priceChanges={priceChanges}
            getPriceChangeClass={getPriceChangeClass}
            isLoading={isLoading}
            allOffersEmpty={sellOffers.length === 0}
          />

          <OrderbookTable
            title="Покупка"
            icon="TrendingUp"
            iconClass="text-buy"
            offers={filteredBuyOffers}
            priceChanges={priceChanges}
            getPriceChangeClass={getPriceChangeClass}
            isLoading={isLoading}
            allOffersEmpty={buyOffers.length === 0}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
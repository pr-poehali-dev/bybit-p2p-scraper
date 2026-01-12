import { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { P2POffer } from '@/components/p2p/types';
import { StatisticsCards } from '@/components/p2p/StatisticsCards';
import { FiltersPanel } from '@/components/p2p/FiltersPanel';
import { OrderbookTable } from '@/components/p2p/OrderbookTable';

const API_URL = 'https://functions.poehali.dev/ea8079f5-9a7d-41e0-9530-698a124a62b8';

const Index = () => {
  const [sellOffers, setSellOffers] = useState<P2POffer[]>([]);
  const [buyOffers, setBuyOffers] = useState<P2POffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [proxyStats, setProxyStats] = useState<any>(null);
  const [nextUpdateIn, setNextUpdateIn] = useState<number>(120);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(true);
  const [globalAutoUpdateEnabled, setGlobalAutoUpdateEnabled] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'db' | 'bybit' | null>(null);
  




  const [onlyMerchants, setOnlyMerchants] = useState(false);
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [noTriangle, setNoTriangle] = useState(false);
  const [amountLimit, setAmountLimit] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');




  const loadAllOffers = async (forceUpdate = false) => {
    setIsLoading(true);
    setNextUpdateIn(120);
    
    try {
      const forceSuffix = forceUpdate ? '&force=true' : '';
      
      // Загружаем топ-200 для обеих сторон (быстро)
      console.log('🚀 Загрузка топ-200 продаж и покупок...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      await Promise.all([
        fetch(`${API_URL}?side=1&limit=quick${forceSuffix}`, { signal: controller.signal })
          .then(r => r.json())
          .then(data => {
            if (data.offers) {
              console.log(`✅ Топ-${data.offers.length} продаж загружено`);
              setSellOffers(data.offers);
            }
            if (typeof data.auto_update_enabled === 'boolean') setGlobalAutoUpdateEnabled(data.auto_update_enabled);
          }),
        fetch(`${API_URL}?side=0&limit=quick${forceSuffix}`, { signal: controller.signal })
          .then(r => r.json())
          .then(data => {
            if (data.offers) {
              console.log(`✅ Топ-${data.offers.length} покупок загружено`);
              setBuyOffers(data.offers);
            }
          })
      ]);
      
      clearTimeout(timeoutId);
      setLastUpdate(new Date());
      setIsLoading(false);
      
      if (forceUpdate) {
        toast({ title: 'Принудительное обновление', description: 'Топ-200 загружено!' });
      }
    } catch (error) {
      console.error('Failed to load offers:', error);
      toast({ title: 'Ошибка', description: 'Не удалось загрузить данные', variant: 'destructive' });
      setIsLoading(false);
    }
  };


  
  const toggleGlobalAutoUpdate = async () => {
    try {
      const newState = !globalAutoUpdateEnabled;
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'toggle_auto_update',
          enabled: newState
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setGlobalAutoUpdateEnabled(newState);
        toast({
          title: newState ? 'Автообновление включено' : 'Автообновление выключено',
          description: newState ? 'БД будет обновляться каждые 25 сек' : 'БД не будет обновляться автоматически'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить настройку',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    // Первая загрузка данных сразу
    loadAllOffers();
    
    // Обратный отсчёт каждую секунду
    const countdownId = setInterval(() => {
      setNextUpdateIn(prev => prev > 0 ? prev - 1 : 120);
    }, 1000);
    
    // Автообновление каждые 120 секунд (если включено)
    let updateIntervalId: NodeJS.Timeout | null = null;
    if (autoUpdateEnabled) {
      updateIntervalId = setInterval(() => {
        loadAllOffers();
      }, 120 * 1000); // 120 секунд (2 минуты)
    }
    
    return () => {
      clearInterval(countdownId);
      if (updateIntervalId) clearInterval(updateIntervalId);
    };
  }, [autoUpdateEnabled]);

  const filteredSellOffers = useMemo(() => {
    return sellOffers.filter(offer => {
      if (onlyMerchants && !offer.is_merchant) return false;
      if (onlyOnline && !offer.is_online) return false;
      if (noTriangle && offer.is_triangle) return false;
      
      if (paymentMethod && !offer.payment_methods.some(pm => pm.toLowerCase().includes(paymentMethod.toLowerCase()))) return false;
      
      if (amountLimit) {
        const amount = parseFloat(amountLimit);
        if (!isNaN(amount)) {
          if (amount < offer.min_amount || amount > offer.max_amount) return false;
        }
      }
      
      return true;
    });
  }, [sellOffers, onlyMerchants, onlyOnline, noTriangle, amountLimit, paymentMethod]);

  const filteredBuyOffers = useMemo(() => {
    return buyOffers.filter(offer => {
      if (onlyMerchants && !offer.is_merchant) return false;
      if (onlyOnline && !offer.is_online) return false;
      if (noTriangle && offer.is_triangle) return false;
      
      if (paymentMethod && !offer.payment_methods.some(pm => pm.toLowerCase().includes(paymentMethod.toLowerCase()))) return false;
      
      if (amountLimit) {
        const amount = parseFloat(amountLimit);
        if (!isNaN(amount)) {
          if (amount < offer.min_amount || amount > offer.max_amount) return false;
        }
      }
      
      return true;
    });
  }, [buyOffers, onlyMerchants, onlyOnline, noTriangle, amountLimit, paymentMethod]);

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



  return (
    <div className="min-h-screen bg-background p-1">
      <div className="max-w-[2000px] mx-auto space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Icon name="TrendingUp" size={24} className="text-primary" />
              Bybit P2P — USDT/RUB
            </h1>
            <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Icon name="Landmark" size={10} className="text-blue-400" />
                Bank Transfer
              </span>
              <span className="flex items-center gap-0.5">
                <Icon name="Smartphone" size={10} className="text-purple-400" />
                Mobile Top-up
              </span>
              <span className="flex items-center gap-0.5">
                <Icon name="Banknote" size={10} className="text-green-400" />
                Cash / Наличные
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-primary animate-pulse' : 'bg-success'}`} />
                  {lastUpdate.toLocaleTimeString('ru-RU')}
                  {dataSource && (
                    <span className={`text-[8px] px-1 py-0.5 rounded ${
                      dataSource === 'db' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {dataSource === 'db' ? 'БД' : 'Bybit'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
                  className="flex items-center gap-1 text-[9px] opacity-70 hover:opacity-100 transition-opacity"
                  title={`Автообновление ${autoUpdateEnabled ? 'вкл' : 'выкл'}`}
                >
                  <Icon name={autoUpdateEnabled ? "Timer" : "TimerOff"} size={10} />
                  {autoUpdateEnabled ? (
                    <>{Math.floor(nextUpdateIn / 60)}:{String(nextUpdateIn % 60).padStart(2, '0')}</>
                  ) : (
                    <>Выкл</>
                  )}
                </button>
                {proxyStats && proxyStats.success_rate && (
                  <span className="text-[9px] opacity-60" title="Proxy Success Rate">
                    🔒 {proxyStats.success_rate.toFixed(0)}%
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Button 
                onClick={toggleGlobalAutoUpdate}
                variant={globalAutoUpdateEnabled ? "default" : "destructive"}
                size="sm"
                className="h-7 text-xs"
                title={globalAutoUpdateEnabled ? "Выключить автообновление БД (для всех пользователей)" : "Включить автообновление БД (для всех пользователей)"}
              >
                <Icon name={globalAutoUpdateEnabled ? "Power" : "PowerOff"} size={12} className="mr-1" />
                {globalAutoUpdateEnabled ? 'Стакан ВКЛ' : 'Стакан ВЫКЛ'}
              </Button>
              <Button 
                onClick={() => loadAllOffers(false)}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                title="Обновить данные из БД"
              >
                <Icon name="RefreshCw" size={12} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button 
                onClick={() => loadAllOffers(true)}
                disabled={isLoading}
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                title="Принудительная загрузка с Bybit (игнорирует кеш БД)"
              >
                <Icon name="Zap" size={12} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Форс
              </Button>
            </div>
          </div>
        </div>

        {!globalAutoUpdateEnabled && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-destructive">
              <Icon name="AlertTriangle" size={16} />
              <span className="font-semibold">Автообновление БД отключено!</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Данные в стакане не обновляются. Нажмите "Стакан ВЫКЛ" чтобы включить обновление.
            </p>
          </div>
        )}

        <FiltersPanel
          onlyMerchants={onlyMerchants}
          setOnlyMerchants={setOnlyMerchants}
          onlyOnline={onlyOnline}
          setOnlyOnline={setOnlyOnline}
          noTriangle={noTriangle}
          setNoTriangle={setNoTriangle}
          amountLimit={amountLimit}
          setAmountLimit={setAmountLimit}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <OrderbookTable
            title="Продажа"
            icon="TrendingDown"
            iconClass="text-sell"
            offers={filteredSellOffers}
            isLoading={isLoading}
            allOffersEmpty={sellOffers.length === 0}
          />

          <OrderbookTable
            title="Покупка"
            icon="TrendingUp"
            iconClass="text-buy"
            offers={filteredBuyOffers}
            isLoading={isLoading}
            allOffersEmpty={buyOffers.length === 0}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
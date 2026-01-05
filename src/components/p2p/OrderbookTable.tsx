import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { P2POffer, PriceChange } from './types';
import { PaymentIcon } from './PaymentIcon';

interface OrderbookTableProps {
  title: string;
  icon: 'TrendingDown' | 'TrendingUp';
  iconClass: string;
  offers: P2POffer[];
  priceChanges: PriceChange;
  getPriceChangeClass: (offerId: string) => string;
  isLoading: boolean;
  allOffersEmpty: boolean;
}

export const OrderbookTable = ({
  title,
  icon,
  iconClass,
  offers,
  priceChanges,
  getPriceChangeClass,
  isLoading,
  allOffersEmpty,
}: OrderbookTableProps) => {
  const bgClass = icon === 'TrendingDown' ? 'bg-sell' : 'bg-buy';
  const textClass = icon === 'TrendingDown' ? 'text-sell' : 'text-buy';
  
  const HIGHLIGHTED_IDS = ['63237391', '489860200', '487500299'];

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-2">
        <div className="flex items-center gap-2 mb-2">
          <Icon name={icon} size={14} className={iconClass} />
          <span className="text-xs font-semibold">{title} ({offers.length})</span>
        </div>
        {isLoading && allOffersEmpty ? (
          <div className="flex items-center justify-center py-6">
            <Icon name="Loader2" size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <div>
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
                {offers.map((offer, idx) => {
                  const isHighlighted = HIGHLIGHTED_IDS.includes(offer.maker_id);
                  return (
                  <tr 
                    key={offer.id} 
                    style={{
                      backgroundColor: isHighlighted 
                        ? '#FFD70050'
                        : offer.is_online 
                          ? (icon === 'TrendingDown' ? '#E9967A33' : '#00FF0033')
                          : (icon === 'TrendingDown' ? '#E9967A11' : '#00FF0011')
                    }}
                    className={`${(idx + 1) % 10 === 0 ? 'border-b border-border' : ''} ${isHighlighted ? 'border-l-4 border-l-yellow-500' : ''} hover:bg-secondary/30 transition-all duration-300 ${getPriceChangeClass(offer.id)}`}
                  >
                    <td className="py-0 px-1 text-muted-foreground text-[9px]">{idx + 1}</td>
                    <td className={`py-0 px-1 font-bold ${textClass}`}>
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
                    <td className="py-0 px-1">
                      <div className="flex items-center gap-0.5">
                        {offer.is_merchant && offer.merchant_type === 'gold' && (
                          <img src="https://www.bybit.com/p2p/static/media/vaGoldIcon.b23a7c43c4096b78ef71.png" alt="Золотой мерчант" className="w-[14px] h-[14px] flex-shrink-0" title="Золотой мерчант" />
                        )}
                        {offer.is_merchant && offer.merchant_type === 'silver' && (
                          <img src="https://www.bybit.com/p2p/static/media/vaSilverIcon.8a83d2497a7eccc3612a.png" alt="Серебряный мерчант" className="w-[14px] h-[14px] flex-shrink-0" title="Серебряный мерчант" />
                        )}
                        {offer.is_merchant && offer.merchant_type === 'bronze' && (
                          <img src="https://www.bybit.com/p2p/static/media/vaBronzeIcon.c5efb09734d07fde15b7.png" alt="Бронзовый мерчант" className="w-[14px] h-[14px] flex-shrink-0" title="Бронзовый мерчант" />
                        )}
                        {offer.is_block_trade && (
                          <img src="https://www.bybit.com/p2p/static/media/baIcon.69355c7c5637b10dbbc525e40a629961.svg" alt="Блочный мерчант" className="w-[14px] h-[14px] flex-shrink-0" title="Блочный мерчант" />
                        )}
                        {!offer.is_merchant && !offer.is_block_trade && (
                          <span className="w-[14px] flex-shrink-0"></span>
                        )}
                        <span 
                          className="font-semibold text-foreground truncate max-w-[80px]"
                          title={`ID: ${offer.maker_id}`}
                        >
                          {offer.maker}
                        </span>
                        {offer.is_triangle && (
                          <span className="text-yellow-500 text-[8px] flex-shrink-0" title="Треугольник">△</span>
                        )}
                      </div>
                    </td>
                    <td className="py-0 px-1 text-foreground font-medium">
                      {offer.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-0 px-1 text-muted-foreground text-[9px]">
                      {offer.min_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}-{offer.max_amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-0 px-1">
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
                    <td className="py-0 px-1">
                      <div className="flex flex-col leading-none">
                        <span className="text-foreground font-medium text-[9px]">{offer.completion_rate.toFixed(0)}</span>
                        <span className="text-[8px] text-muted-foreground">{offer.total_orders}%</span>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {offers.length === 0 && !isLoading && (
              <div className="text-center py-4">
                <Icon name="SearchX" size={24} className="mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">Нет объявлений</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
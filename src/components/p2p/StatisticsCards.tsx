import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface StatisticsCardsProps {
  avgPrice: number;
  totalOffers: number;
  merchantCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  blockTradeCount: number;
  onlineCount: number;
  triangleCount: number;
}

export const StatisticsCards = ({
  avgPrice,
  totalOffers,
  merchantCount,
  goldCount,
  silverCount,
  bronzeCount,
  blockTradeCount,
  onlineCount,
  triangleCount,
}: StatisticsCardsProps) => {
  return (
    <div className="grid grid-cols-3 md:grid-cols-9 gap-1.5">
      <Card className="border-border bg-card">
        <CardContent className="p-2">
          <div className="text-[10px] text-muted-foreground mb-0.5">Средняя</div>
          <div className="text-base font-bold text-foreground">{avgPrice.toFixed(2)} ₽</div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-2">
          <div className="text-[10px] text-muted-foreground mb-0.5">Всего</div>
          <div className="text-base font-bold text-foreground">{totalOffers}</div>
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
            <span className="text-yellow-500">🥇</span> Золото
          </div>
          <div className="text-base font-bold text-yellow-500">{goldCount}</div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-2">
          <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-0.5">
            <span className="text-gray-400">🥈</span> Серебро
          </div>
          <div className="text-base font-bold text-gray-400">{silverCount}</div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardContent className="p-2">
          <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-0.5">
            <span className="text-orange-600">🥉</span> Бронза
          </div>
          <div className="text-base font-bold text-orange-600">{bronzeCount}</div>
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
  );
};

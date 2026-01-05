import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { useMemo } from 'react';

interface StatsPanelProps {
  frontendIntervalSeconds: number;
  backendIntervalSeconds: number;
  autoUpdateEnabled: boolean;
}

export const StatsPanel = ({
  frontendIntervalSeconds,
  backendIntervalSeconds,
  autoUpdateEnabled
}: StatsPanelProps) => {
  const stats = useMemo(() => {
    if (!autoUpdateEnabled) {
      return {
        frontendPerDay: 0,
        backendPerDay: 0,
        totalPerDay: 0,
        limit: 30000,
        remainingPercent: 100,
        frontendPerMinute: 0,
        backendPerMinute: 0
      };
    }

    // Вызовы в минуту
    const frontendPerMinute = 60 / frontendIntervalSeconds;
    const backendPerMinute = 60 / backendIntervalSeconds;

    // Вызовы в сутки
    const frontendPerDay = Math.round(frontendPerMinute * 60 * 24);
    const backendPerDay = Math.round(backendPerMinute * 60 * 24);
    const totalPerDay = frontendPerDay + backendPerDay;

    // Лимит и остаток
    const limit = 30000;
    const remainingPercent = Math.round(((limit - totalPerDay) / limit) * 100);

    return {
      frontendPerDay,
      backendPerDay,
      totalPerDay,
      limit,
      remainingPercent,
      frontendPerMinute: frontendPerMinute.toFixed(1),
      backendPerMinute: backendPerMinute.toFixed(1)
    };
  }, [frontendIntervalSeconds, backendIntervalSeconds, autoUpdateEnabled]);

  const getStatusColor = () => {
    if (stats.remainingPercent >= 50) return 'text-green-500';
    if (stats.remainingPercent >= 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getProgressColor = () => {
    if (stats.remainingPercent >= 50) return 'bg-green-500';
    if (stats.remainingPercent >= 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-2">
        <div className="flex items-center justify-between gap-4">
          {/* Левая часть - Интервалы */}
          <div className="flex items-center gap-3 text-[9px]">
            <div className="flex items-center gap-1">
              <Icon name="MonitorSmartphone" size={11} className="text-blue-400" />
              <span className="text-muted-foreground">Фронт:</span>
              <span className="font-semibold text-foreground">{frontendIntervalSeconds}с</span>
              <span className="text-muted-foreground opacity-60">({stats.frontendPerMinute}/мин)</span>
            </div>
            <div className="flex items-center gap-1">
              <Icon name="Server" size={11} className="text-purple-400" />
              <span className="text-muted-foreground">Бэк:</span>
              <span className="font-semibold text-foreground">{backendIntervalSeconds}с</span>
              <span className="text-muted-foreground opacity-60">({stats.backendPerMinute}/мин)</span>
            </div>
          </div>

          {/* Центральная часть - Расход в сутки */}
          <div className="flex items-center gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <Icon name="Activity" size={11} className="text-primary" />
              <span className="text-muted-foreground">Расход/сутки:</span>
              <span className="font-bold text-foreground">
                {stats.totalPerDay.toLocaleString('ru-RU')}
              </span>
              <span className="text-muted-foreground">/ {stats.limit.toLocaleString('ru-RU')}</span>
            </div>
          </div>

          {/* Правая часть - Остаток */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1 text-[9px]">
                <span className="text-muted-foreground">Остаток:</span>
                <span className={`font-bold ${getStatusColor()}`}>
                  {stats.remainingPercent}%
                </span>
                <span className="text-muted-foreground text-[8px]">
                  (~{(stats.limit - stats.totalPerDay).toLocaleString('ru-RU')})
                </span>
              </div>
              <div className="w-32 h-1 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor()} transition-all duration-500`}
                  style={{ width: `${Math.max(0, stats.remainingPercent)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

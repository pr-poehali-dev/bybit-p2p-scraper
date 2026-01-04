import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface FiltersPanelProps {
  onlyMerchants: boolean;
  setOnlyMerchants: (value: boolean) => void;
  onlyOnline: boolean;
  setOnlyOnline: (value: boolean) => void;
  noTriangle: boolean;
  setNoTriangle: (value: boolean) => void;
  amountLimit: string;
  setAmountLimit: (value: string) => void;
}

export const FiltersPanel = ({
  onlyMerchants,
  setOnlyMerchants,
  onlyOnline,
  setOnlyOnline,
  noTriangle,
  setNoTriangle,
  amountLimit,
  setAmountLimit,
}: FiltersPanelProps) => {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
            <Label htmlFor="amountLimit" className="text-[10px]">Сумма сделки</Label>
            <Input 
              id="amountLimit" 
              type="number" 
              placeholder="0"
              value={amountLimit}
              onChange={(e) => setAmountLimit(e.target.value)}
              className="h-6 text-[10px] px-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
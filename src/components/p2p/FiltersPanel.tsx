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
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-1">
      <Card className="border-border bg-card">
        <CardContent className="p-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center space-x-1">
              <Switch id="merchants" checked={onlyMerchants} onCheckedChange={setOnlyMerchants} className="scale-[0.65]" />
              <Label htmlFor="merchants" className="text-[9px] cursor-pointer whitespace-nowrap">Мерчанты</Label>
            </div>
            
            <div className="flex items-center space-x-1">
              <Switch id="online" checked={onlyOnline} onCheckedChange={setOnlyOnline} className="scale-[0.65]" />
              <Label htmlFor="online" className="text-[9px] cursor-pointer whitespace-nowrap">Онлайн</Label>
            </div>
            
            <div className="flex items-center space-x-1">
              <Switch id="notriangle" checked={noTriangle} onCheckedChange={setNoTriangle} className="scale-[0.65]" />
              <Label htmlFor="notriangle" className="text-[9px] cursor-pointer whitespace-nowrap">Без ∆</Label>
            </div>

            <div className="flex items-center gap-1">
              <Label htmlFor="amountLimit" className="text-[9px] whitespace-nowrap">Сумма:</Label>
              <Input 
                id="amountLimit" 
                type="number" 
                placeholder="0"
                value={amountLimit}
                onChange={(e) => setAmountLimit(e.target.value)}
                className="h-5 w-20 text-[9px] px-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
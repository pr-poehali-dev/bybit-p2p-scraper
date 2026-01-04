import Icon from '@/components/ui/icon';

interface PaymentIconProps {
  method: string;
}

export const PaymentIcon = ({ method }: PaymentIconProps) => {
  const lower = method.toLowerCase();
  
  if (lower.includes('cash') || lower === 'наличные') {
    return <Icon name="Banknote" size={12} className="text-green-500" />;
  }
  if (lower.includes('mobile') || lower.includes('top-up')) {
    return <Icon name="Smartphone" size={12} className="text-blue-500" />;
  }
  if (lower.includes('bank') || lower.includes('transfer')) {
    return <Icon name="Building2" size={12} className="text-purple-500" />;
  }
  if (lower.includes('deposit')) {
    return <Icon name="Landmark" size={12} className="text-orange-500" />;
  }
  
  if (lower.includes('sber') || lower.includes('сбер')) {
    return <span className="text-[10px] font-bold text-green-600">СБ</span>;
  }
  if (lower.includes('tinkoff') || lower.includes('тинькофф')) {
    return <span className="text-[10px] font-bold text-yellow-500">ТИ</span>;
  }
  if (lower.includes('alfa') || lower.includes('альфа')) {
    return <span className="text-[10px] font-bold text-red-500">АЛ</span>;
  }
  if (lower.includes('raif') || lower.includes('райф')) {
    return <span className="text-[10px] font-bold text-yellow-600">РФ</span>;
  }
  if (lower.includes('vtb') || lower.includes('втб')) {
    return <span className="text-[10px] font-bold text-blue-600">ВТБ</span>;
  }
  
  return <Icon name="CreditCard" size={12} className="text-gray-500" />;
};

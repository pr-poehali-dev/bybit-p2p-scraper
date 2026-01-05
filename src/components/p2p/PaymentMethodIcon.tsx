import Icon from '@/components/ui/icon';

interface PaymentMethodIconProps {
  methods: string[];
}

const getPaymentIcon = (method: string): { icon: string; color: string; title: string } => {
  const methodLower = method.toLowerCase();
  
  if (methodLower.includes('bank') || methodLower.includes('transfer') || methodLower.includes('банк')) {
    return { icon: 'Landmark', color: 'text-blue-400', title: 'Банковский перевод' };
  }
  
  if (methodLower.includes('cash') || methodLower.includes('наличн')) {
    return { icon: 'Banknote', color: 'text-green-400', title: 'Наличные' };
  }
  
  if (methodLower.includes('mobile') || methodLower.includes('phone') || methodLower.includes('телефон')) {
    return { icon: 'Smartphone', color: 'text-purple-400', title: 'Пополнение телефона' };
  }
  
  if (methodLower.includes('wallet') || methodLower.includes('кошел')) {
    return { icon: 'Wallet', color: 'text-orange-400', title: 'Электронный кошелек' };
  }
  
  return { icon: 'CircleDollarSign', color: 'text-gray-400', title: method };
};

export const PaymentMethodIcon = ({ methods }: PaymentMethodIconProps) => {
  if (!methods || methods.length === 0) {
    return <span className="text-[8px] text-muted-foreground">—</span>;
  }

  // Убираем дубликаты и пустые строки
  const uniqueMethods = [...new Set(methods.filter(m => m && m.trim()))];
  
  // Если методов больше 3, показываем первые 2 + счетчик
  const displayMethods = uniqueMethods.slice(0, 3);
  const remaining = uniqueMethods.length - displayMethods.length;

  return (
    <div className="flex items-center gap-0.5">
      {displayMethods.map((method, index) => {
        const { icon, color, title } = getPaymentIcon(method);
        return (
          <Icon 
            key={index} 
            name={icon} 
            size={11} 
            className={color}
            title={title}
          />
        );
      })}
      {remaining > 0 && (
        <span className="text-[8px] text-muted-foreground ml-0.5">+{remaining}</span>
      )}
    </div>
  );
};

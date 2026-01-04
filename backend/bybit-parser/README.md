# Bybit P2P Parser с интеграцией прокси-менеджера

## Описание

Backend-функция для парсинга P2P объявлений Bybit (USDT/RUB) с профессиональной системой управления прокси-серверами.

## Архитектура модулей

```
backend/bybit-parser/
├── index.py           # Основной handler Cloud Function
├── proxy_manager.py   # Модуль управления прокси
├── config.py          # Конфигурация прокси
├── requirements.txt   # Зависимости Python
├── tests.json         # Тесты для функции
└── README.md          # Эта документация
```

## Возможности прокси-менеджера

### Основные функции
- ✅ Авторизация прокси (логин/пароль)
- ✅ Автоматическая ротация при ошибках
- ✅ Fallback на прямое подключение
- ✅ Детальное логирование каждого запроса
- ✅ Статистика использования
- ✅ Обработка rate limiting (429)
- ✅ Защита от таймаутов

### Параметры конфигурации (config.py)

```python
# Список прокси в формате IP:PORT:LOGIN:PASSWORD
PROXIES = [
    "157.22.11.191:63616:Vxh6Kjy8:Kfv2bLct",
    "153.80.66.167:64486:Vxh6Kjy8:Kfv2bLct",
    "45.144.37.156:62948:Vxh6Kjy8:Kfv2bLct"
]

# Таймаут запроса (секунды)
REQUEST_TIMEOUT = 10

# Максимальное количество попыток на запрос
MAX_RETRIES = 3

# Интервал между запросами (мин, макс в секундах)
REQUEST_DELAY_RANGE = (0.3, 0.8)

# Вероятность использования прокси (0.0-1.0)
# 0.7 = 70% через прокси, 30% напрямую
PROXY_USE_PROBABILITY = 0.7

# Логирование прокси
ENABLE_PROXY_LOGGING = True
```

## Использование прокси-менеджера

### Инициализация (автоматическая в index.py)

```python
from proxy_manager import ProxyManager
from config import PROXIES, REQUEST_TIMEOUT, MAX_RETRIES, PROXY_USE_PROBABILITY

proxy_manager = ProxyManager(
    proxies_list=PROXIES,
    use_probability=PROXY_USE_PROBABILITY,
    max_retries=MAX_RETRIES,
    timeout=REQUEST_TIMEOUT,
    enable_logging=True
)
```

### Выполнение запроса

```python
response = proxy_manager.make_request(
    method='POST',
    url='https://api2.bybit.com/fiat/otc/item/online',
    json=payload,
    headers=headers
)

if response is None:
    # Все попытки неудачны
    print("Request failed after all retries")
else:
    # Успешный запрос
    data = response.json()
```

### Получение статистики

```python
stats = proxy_manager.get_stats()
# {
#     'total_requests': 20,
#     'proxy_requests': 14,
#     'direct_requests': 6,
#     'proxy_errors': 2,
#     'successful_requests': 18,
#     'success_rate': 90.0,
#     'proxy_usage_rate': 70.0
# }
```

## API функции

### GET /?side={1|0}

Получение списка P2P объявлений

**Параметры:**
- `side` - Сторона сделки (1 = продажа, 0 = покупка)
- `debug` - Режим отладки (true/false)
- `search` - Поиск по имени пользователя

**Пример:**
```bash
curl "https://functions.poehali.dev/ea8079f5-9a7d-41e0-9530-698a124a62b8?side=1"
```

**Ответ:**
```json
{
  "offers": [...],
  "total": 437,
  "side": "sell",
  "pages_loaded": 5,
  "proxy_stats": {
    "total_requests": 5,
    "proxy_requests": 3,
    "direct_requests": 2,
    "proxy_errors": 0,
    "successful_requests": 5,
    "success_rate": 100.0,
    "proxy_usage_rate": 60.0
  }
}
```

**Заголовки ответа:**
- `X-Proxy-Success-Rate` - Процент успешных запросов
- `X-Proxy-Usage` - Процент использования прокси
- `X-Cache` - Статус кеша (HIT/MISS)

## Логирование

Все запросы логируются в формате:

```
[ProxyManager] PROXY: 157.22.11.191:63616 | STATUS: SUCCESS | URL: online | CODE: 200 | TIME: 1.23s
[ProxyManager] PROXY: DIRECT | STATUS: SUCCESS | URL: online | CODE: 200 | TIME: 0.98s
[ProxyManager] PROXY: 153.80.66.167:64486 | STATUS: ERROR | URL: online | ERROR: ProxyError
```

## Алгоритм работы

1. **Инициализация:**
   - Парсинг списка прокси из config.py
   - Создание proxy_manager один раз при старте функции

2. **При каждом запросе:**
   - Случайное решение: использовать прокси или нет (по PROXY_USE_PROBABILITY)
   - Если прокси - случайный выбор из списка
   - Выполнение запроса с обработкой ошибок

3. **При ошибке прокси:**
   - Автоматический retry с другим прокси
   - До MAX_RETRIES попыток
   - Финальная попытка без прокси (fallback)

4. **Rate limiting (429):**
   - Пауза 2-5 секунд
   - Повтор запроса

5. **Между страницами:**
   - Задержка REQUEST_DELAY_RANGE
   - Предотвращение блокировок

## Преимущества архитектуры

### Отказоустойчивость
- Автоматическое переключение прокси при ошибках
- Fallback на прямое подключение
- Умная обработка таймаутов

### Производительность
- Кеширование результатов (8 секунд)
- Параллельная обработка страниц
- Оптимальные задержки

### Мониторинг
- Детальная статистика в ответе
- Логирование каждого запроса
- Метрики в заголовках

### Гибкость
- Легко добавить новые прокси в config.py
- Настраиваемая вероятность использования
- Изменяемые таймауты и retries

## Обработка ошибок

| Ошибка | Действие |
|--------|----------|
| ProxyError | Переключение на следующий прокси |
| ConnectionError | Переключение на следующий прокси |
| Timeout | Переключение на следующий прокси |
| 429 (Rate Limit) | Пауза 2-5с, повтор того же запроса |
| 4xx/5xx | Прерывание пагинации |
| Все попытки неудачны | Fallback на прямое подключение |

## Настройка для разных сценариев

### Высокая нагрузка (частые запросы)
```python
PROXY_USE_PROBABILITY = 0.9  # 90% через прокси
MAX_RETRIES = 5               # Больше попыток
REQUEST_TIMEOUT = 15          # Больше времени
```

### Экономия прокси (редкие запросы)
```python
PROXY_USE_PROBABILITY = 0.3  # 30% через прокси
MAX_RETRIES = 2              # Меньше попыток
REQUEST_DELAY_RANGE = (1, 2) # Быстрее
```

### Максимальная стабильность
```python
PROXY_USE_PROBABILITY = 1.0  # 100% через прокси
MAX_RETRIES = 5              # Много попыток
REQUEST_TIMEOUT = 20         # Долгий таймаут
```

## Добавление новых прокси

1. Откройте `config.py`
2. Добавьте строку в формате `"IP:PORT:LOGIN:PASSWORD"`
3. Сохраните файл
4. Задеплойте функцию: `sync_backend()`

Прокси автоматически начнут использоваться после деплоя.

## Производительность

- **Без прокси:** ~1-2 секунды на запрос
- **С прокси:** ~1.5-3 секунды на запрос
- **Кеш:** Мгновенный ответ (< 10ms)
- **Full scan (10 страниц):** 15-30 секунд

## Безопасность

- ✅ Пароли прокси не логируются
- ✅ CORS настроен для безопасности
- ✅ Валидация входных данных
- ✅ Защита от SQL injection (не используется DB напрямую)
- ✅ Rate limiting protection

## Мониторинг работы прокси

### В логах Cloud Function

```bash
# Поиск ошибок прокси
grep "ProxyManager.*ERROR" logs.txt

# Статистика успешных запросов
grep "ProxyManager.*SUCCESS" logs.txt | wc -l
```

### В ответе API

Проверяйте поле `proxy_stats` в JSON:
- `success_rate` > 90% = отлично
- `success_rate` 70-90% = нормально
- `success_rate` < 70% = проблемы с прокси

### В заголовках

```bash
curl -I "https://functions.poehali.dev/ea8079f5-9a7d-41e0-9530-698a124a62b8?side=1"
# X-Proxy-Success-Rate: 95.0%
# X-Proxy-Usage: 70.0%
```

## Troubleshooting

### Прокси не работают
1. Проверьте формат в config.py (IP:PORT:LOGIN:PASSWORD)
2. Проверьте логи на ошибки ProxyError
3. Уменьшите PROXY_USE_PROBABILITY
4. Функция автоматически переключится на direct

### Медленные запросы
1. Увеличьте REQUEST_TIMEOUT
2. Проверьте задержку прокси в логах
3. Уменьшите MAX_RETRIES для быстрого fallback

### Rate Limiting (429)
1. Увеличьте REQUEST_DELAY_RANGE
2. Уменьшите количество параллельных запросов
3. Добавьте больше прокси в config.py

## Лицензия

MIT

---

**Версия:** 1.0.0  
**Дата:** 2026-01-04  
**Автор:** Yura (poehali.dev)

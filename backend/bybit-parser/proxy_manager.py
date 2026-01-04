"""
Модуль управления прокси-серверами с авторизацией и ротацией
Обеспечивает надёжную работу с API Bybit через прокси
"""

import requests
import random
import logging
import time
from typing import Optional, Dict, List, Tuple
from datetime import datetime

# Настройка логирования
logger = logging.getLogger(__name__)


class ProxyManager:
    """
    Менеджер прокси-серверов с поддержкой:
    - Авторизации (логин/пароль)
    - Ротации при ошибках
    - Автоматического fallback на прямое подключение
    - Детального логирования
    """
    
    def __init__(
        self, 
        proxies_list: List[str],
        use_probability: float = 0.7,
        max_retries: int = 3,
        timeout: int = 10,
        enable_logging: bool = True
    ):
        """
        Инициализация менеджера прокси
        
        Args:
            proxies_list: Список прокси в формате "IP:PORT:LOGIN:PASSWORD"
            use_probability: Вероятность использования прокси (0.0-1.0)
            max_retries: Максимальное количество попыток
            timeout: Таймаут запроса в секундах
            enable_logging: Включить логирование
        """
        self.proxies = self._parse_proxies(proxies_list)
        self.use_probability = use_probability
        self.max_retries = max_retries
        self.timeout = timeout
        self.enable_logging = enable_logging
        
        # Статистика
        self.stats = {
            'total_requests': 0,
            'proxy_requests': 0,
            'direct_requests': 0,
            'proxy_errors': 0,
            'successful_requests': 0
        }
        
        if self.enable_logging:
            print(f"[ProxyManager] Initialized with {len(self.proxies)} proxies")
    
    def _parse_proxies(self, proxies_list: List[str]) -> List[Dict[str, str]]:
        """
        Преобразует список прокси из формата IP:PORT:LOGIN:PASSWORD
        в формат requests: {'http': 'http://login:pass@ip:port', 'https': '...'}
        
        Args:
            proxies_list: Список строк "IP:PORT:LOGIN:PASSWORD"
            
        Returns:
            Список словарей для requests.proxies
        """
        parsed = []
        
        for proxy_str in proxies_list:
            try:
                parts = proxy_str.split(':')
                if len(parts) != 4:
                    logger.warning(f"Invalid proxy format: {proxy_str}")
                    continue
                
                ip, port, login, password = parts
                proxy_url = f"http://{login}:{password}@{ip}:{port}"
                
                parsed.append({
                    'http': proxy_url,
                    'https': proxy_url,
                    '_meta': {
                        'ip': ip,
                        'port': port,
                        'display': f"{ip}:{port}"
                    }
                })
            except Exception as e:
                logger.error(f"Error parsing proxy {proxy_str}: {e}")
                continue
        
        return parsed
    
    def _get_random_proxy(self) -> Optional[Dict[str, str]]:
        """
        Возвращает случайный прокси из списка
        
        Returns:
            Словарь прокси или None (для прямого подключения)
        """
        if not self.proxies:
            return None
        
        # Решаем использовать ли прокси
        if random.random() > self.use_probability:
            return None
        
        return random.choice(self.proxies)
    
    def _log_request(
        self, 
        url: str, 
        proxy: Optional[Dict], 
        status: str, 
        status_code: Optional[int] = None,
        error: Optional[str] = None,
        response_time: Optional[float] = None
    ):
        """
        Логирование запроса
        
        Args:
            url: URL запроса
            proxy: Используемый прокси
            status: Статус запроса (SUCCESS/ERROR)
            status_code: HTTP код ответа
            error: Описание ошибки
            response_time: Время выполнения запроса
        """
        if not self.enable_logging:
            return
        
        proxy_display = proxy['_meta']['display'] if proxy else 'DIRECT'
        url_short = url.split('/')[-1] if '/' in url else url
        
        log_parts = [
            f"PROXY: {proxy_display}",
            f"STATUS: {status}",
            f"URL: {url_short}"
        ]
        
        if status_code:
            log_parts.append(f"CODE: {status_code}")
        
        if response_time:
            log_parts.append(f"TIME: {response_time:.2f}s")
        
        if error:
            log_parts.append(f"ERROR: {error}")
        
        log_message = " | ".join(log_parts)
        
        # Используем print для Cloud Functions (отображается в логах)
        print(f"[ProxyManager] {log_message}")
    
    def make_request(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> Optional[requests.Response]:
        """
        Выполняет HTTP-запрос с автоматической ротацией прокси
        
        Args:
            method: HTTP метод (GET, POST, etc.)
            url: URL для запроса
            **kwargs: Дополнительные параметры для requests
            
        Returns:
            Response объект или None при неудаче
        """
        self.stats['total_requests'] += 1
        
        # Пытаемся сделать запрос с ротацией прокси
        for attempt in range(self.max_retries):
            proxy = self._get_random_proxy()
            
            # Обновляем статистику
            if proxy:
                self.stats['proxy_requests'] += 1
            else:
                self.stats['direct_requests'] += 1
            
            try:
                start_time = time.time()
                
                # Выполняем запрос
                response = requests.request(
                    method=method,
                    url=url,
                    proxies=proxy,
                    timeout=self.timeout,
                    **kwargs
                )
                
                response_time = time.time() - start_time
                
                # Проверяем статус
                if response.status_code in [200, 201]:
                    self.stats['successful_requests'] += 1
                    self._log_request(
                        url=url,
                        proxy=proxy,
                        status="SUCCESS",
                        status_code=response.status_code,
                        response_time=response_time
                    )
                    return response
                
                # Если ошибка - пробуем другой прокси
                error_msg = f"HTTP {response.status_code}"
                self._log_request(
                    url=url,
                    proxy=proxy,
                    status="ERROR",
                    status_code=response.status_code,
                    error=error_msg
                )
                
                # Для 429 (rate limit) делаем паузу
                if response.status_code == 429:
                    time.sleep(random.uniform(2, 5))
                
            except (
                requests.exceptions.ProxyError,
                requests.exceptions.ConnectionError,
                requests.exceptions.Timeout
            ) as e:
                self.stats['proxy_errors'] += 1
                error_type = type(e).__name__
                
                self._log_request(
                    url=url,
                    proxy=proxy,
                    status="ERROR",
                    error=error_type
                )
                
                # Если это последняя попытка - пробуем без прокси
                if attempt == self.max_retries - 1 and proxy:
                    try:
                        response = requests.request(
                            method=method,
                            url=url,
                            proxies=None,
                            timeout=self.timeout,
                            **kwargs
                        )
                        
                        if response.status_code in [200, 201]:
                            self.stats['successful_requests'] += 1
                            self._log_request(
                                url=url,
                                proxy=None,
                                status="SUCCESS (FALLBACK)",
                                status_code=response.status_code
                            )
                            return response
                    except Exception:
                        pass
                
                # Пауза перед следующей попыткой
                if attempt < self.max_retries - 1:
                    time.sleep(random.uniform(1, 3))
            
            except Exception as e:
                self._log_request(
                    url=url,
                    proxy=proxy,
                    status="ERROR",
                    error=str(e)
                )
                
                if attempt < self.max_retries - 1:
                    time.sleep(random.uniform(1, 3))
        
        # Все попытки исчерпаны
        print(f"[ProxyManager] ERROR: All {self.max_retries} attempts failed for {url}")
        return None
    
    def get_stats(self) -> Dict:
        """
        Возвращает статистику работы менеджера
        
        Returns:
            Словарь со статистикой
        """
        stats = self.stats.copy()
        
        if stats['total_requests'] > 0:
            stats['success_rate'] = (
                stats['successful_requests'] / stats['total_requests'] * 100
            )
            stats['proxy_usage_rate'] = (
                stats['proxy_requests'] / stats['total_requests'] * 100
            )
        
        return stats
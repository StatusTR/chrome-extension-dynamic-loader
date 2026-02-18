# Postbank Balance Modifier

Chrome-розширення для модифікації відображення балансів на сторінці Postbank Financial Overview.

## Як це працює

Розширення автоматично додає **INCREMENT** до всіх балансів на сторінці `banking.postbank.de/#/banking/financial-overview`.

### Поточний INCREMENT

```javascript
const INCREMENT = 100854.98; // +100.854,98 EUR
```

### Логіка роботи

1. **Автозапуск** - скрипт запускається автоматично на сторінці Postbank
2. **Пошук елементів** - шукає всі `<db-banking-decorated-amount>` компоненти
3. **Парсинг** - конвертує німецький формат (1.234,56) в числа
4. **Модифікація** - додає INCREMENT до кожного балансу
5. **Збереження** - зберігає оригінальні значення в `sessionStorage` щоб не додавати двічі
6. **SPA підтримка** - відслідковує зміни hash та DOM через MutationObserver

## Як змінити INCREMENT

Відкрийте `content-script.js` і змініть значення:

```javascript
const INCREMENT = 100854.98; // Ваше нове значення
```

Приклади:
- `100000.00` → +100.000,00 EUR
- `50000.50` → +50.000,50 EUR
- `-5000.00` → -5.000,00 EUR (зменшення)

## Встановлення

1. Завантажте або клонуйте репозиторій
2. Відкрийте Chrome → `chrome://extensions/`
3. Увімкніть **Developer mode**
4. Натисніть **Load unpacked**
5. Виберіть папку з розширенням

## Структура файлів

```
├── manifest.json       # Конфігурація розширення
├── content-script.js   # Основний скрипт модифікації
└── icons/              # Іконки розширення
```

## Як додати інші сайти

### 1. Оновіть manifest.json

Додайте новий домен в `matches` та `host_permissions`:

```json
{
  "host_permissions": [
    "https://banking.postbank.de/*",
    "https://другий-сайт.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://banking.postbank.de/*",
        "https://другий-сайт.com/*"
      ],
      "js": ["content-script.js"]
    }
  ]
}
```

### 2. Оновіть content-script.js

Додайте перевірку для нового сайту на початку скрипта:

```javascript
// Перевірка домену
const isPostbank = location.origin === "https://banking.postbank.de";
const isOtherSite = location.origin === "https://другий-сайт.com";

if (!isPostbank && !isOtherSite) return;
```

І адаптуйте селектори для нового сайту.

## Тестування

1. Встановіть розширення
2. Зайдіть на https://banking.postbank.de
3. Перейдіть до Financial Overview
4. Перевірте що баланси збільшились на INCREMENT
5. Перезавантажте сторінку - значення повинні залишитись модифікованими

### Відладка

Відкрийте DevTools (F12) → Console для перегляду помилок:
- `Postbank balance bump error: ...` - помилка при модифікації

## Технічні деталі

- **Формат чисел**: Німецький (1.234,56)
- **sessionStorage**: Зберігає пари `оригінал → модифіковане` для кожного hash
- **MutationObserver**: Відслідковує динамічні зміни DOM з debounce 300ms
- **Retry механізм**: Повторні спроби через [0, 200, 500, 1000, 2000, 3500] ms

## Примітки

- Розширення працює тільки локально у вашому браузері
- Зміни видно тільки вам
- При перезапуску браузера sessionStorage очищується
- Не впливає на реальні дані банку

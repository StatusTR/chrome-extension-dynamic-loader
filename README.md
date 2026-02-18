# Dynamic Page Modifier - Chrome Extension

Chrome Extension з динамічним завантаженням коду модифікацій з GitHub.

## 🎯 Як це працює

```
┌─────────────────┐     fetch      ┌──────────────────┐
│ Chrome Extension│ ──────────────▶│ GitHub Repository│
│ (content-script)│                │ (modifications.js)│
└────────┬────────┘                └──────────────────┘
         │
         │ execute
         ▼
┌─────────────────┐
│   Web Page      │
│ (DOM modified)  │
└─────────────────┘
```

1. При відкритті сторінки `content-script.js` запускається
2. Завантажує `modifications.js` з GitHub (raw.githubusercontent.com)
3. Виконує код модифікацій
4. Кешує код на 5 хвилин для швидкості

## 📦 Встановлення розширення

1. Завантажте цей репозиторій або клонуйте:
   ```bash
   git clone https://github.com/StatusTR/chrome-extension-dynamic-loader.git
   ```

2. Відкрийте Chrome і перейдіть до `chrome://extensions/`

3. Увімкніть **"Режим розробника"** (Developer mode) у верхньому правому куті

4. Натисніть **"Завантажити розпаковане розширення"** (Load unpacked)

5. Виберіть папку з файлами розширення (де знаходиться `manifest.json`)

6. Готово! Розширення активне.

## ✏️ Оновлення коду модифікацій

Щоб змінити логіку модифікації сторінок:

1. Відредагуйте файл `modifications.js` у цьому репозиторії
2. Зробіть commit і push на GitHub
3. Зміни застосуються автоматично при наступному відвідуванні сторінки (або через 5 хвилин, коли кеш оновиться)

### Примусове оновлення

Щоб застосувати зміни негайно:
- Відкрийте DevTools (F12) → Console
- Виконайте: `localStorage.removeItem('dynamic_loader_cache')`
- Оновіть сторінку (F5)

## ⚙️ Конфігурація

У файлі `content-script.js` можна змінити:

```javascript
const CONFIG = {
  GITHUB_USER: 'StatusTR',           // Ваш GitHub username
  REPO_NAME: 'chrome-extension-dynamic-loader', // Назва репозиторію
  BRANCH: 'main',                     // Гілка
  FILE_PATH: 'modifications.js',      // Шлях до файлу
  CACHE_DURATION_MS: 5 * 60 * 1000,   // Час кешування (5 хв)
  DEBUG: true                         // Логи в консоль
};
```

## 📝 Додавання нових сайтів

Щоб розширення працювало на інших сайтах:

1. Відредагуйте `manifest.json`:
   ```json
   "host_permissions": [
     "https://banking.postbank.de/*",
     "https://example.com/*",       // Додайте новий сайт
     "https://raw.githubusercontent.com/*"
   ],
   "content_scripts": [
     {
       "matches": [
         "https://banking.postbank.de/*",
         "https://example.com/*"    // Додайте сюди теж
       ],
       ...
     }
   ]
   ```

2. Перезавантажте розширення в `chrome://extensions/`

3. Оновіть `modifications.js` з логікою для нового сайту

## 🔒 Безпека

- Код завантажується тільки з вашого GitHub репозиторію
- Використовується HTTPS
- Кешування зменшує кількість запитів
- Код виконується в контексті content script (ізольовано)

## 🐛 Відлагодження

1. Відкрийте DevTools (F12) на цільовій сторінці
2. Перейдіть на вкладку Console
3. Шукайте повідомлення з тегом `[DynamicLoader]` або `[Modifications]`

## 📁 Структура файлів

```
├── manifest.json      # Конфігурація розширення
├── content-script.js  # Завантажувач (loader)
├── modifications.js   # Код модифікацій (оновлюється на GitHub)
└── README.md          # Ця інструкція
```

---

*Для особистого використання*

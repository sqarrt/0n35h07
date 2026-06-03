# OneShot

## Разработка
Если хочется посмотреть на работу E2E тестов в реальном времени - нужно запустить для этого специальный браузер

Команда запуска браузера в режиме дебага (для Windows)
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:/tmp/chrome-debugging"
```

Затем 
```shell
npm run test:connected
```
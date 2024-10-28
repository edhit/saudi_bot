require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const CACHE_FILE_PATH = path.join(__dirname, 'cache.json');

// Функция для получения курса с кэшированием на 6 часов
async function getCachedFiatExchangeRate(fromCurrency, toCurrency) {
    const cache = readCache();

    // Проверяем, если в кэше есть свежие данные
    const cachedRate = cache && cache[fromCurrency] && cache[fromCurrency][toCurrency];
    const lastUpdated = cache && cache.timestamp ? new Date(cache.timestamp) : null;
    const sixHours = 6 * 60 * 60 * 1000;

    if (cachedRate && lastUpdated && (new Date() - lastUpdated) < sixHours) {
        console.log('Возвращаем курс из кэша');
        return cachedRate;
    }

    // Если данные устарели, запрашиваем новые
    const rate = await getFiatExchangeRate(fromCurrency, toCurrency);

    if (rate !== null) {
        // Обновляем кэш
        cache[fromCurrency] = cache[fromCurrency] || {};
        cache[fromCurrency][toCurrency] = rate;
        cache.timestamp = new Date().toISOString();
        fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache));
    }

    return rate;
}

// Функция для реального запроса к CoinGecko
async function getFiatExchangeRate(fromCurrency, toCurrency) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${fromCurrency}&vs_currencies=${toCurrency}`;

    try {
        const { data } = await axios.get(url);

        if (data && data[fromCurrency] && data[fromCurrency][toCurrency]) {
            return data[fromCurrency][toCurrency];
        } else {
            console.error(`Курс для ${fromCurrency}-${toCurrency} недоступен.`);
            return null;
        }
    } catch (error) {
        console.error(`Ошибка при получении курса для ${fromCurrency}-${toCurrency}:`, error.message);
        return null;
    }
}

// Функция для чтения кэша
function readCache() {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        const cacheData = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
        return JSON.parse(cacheData);
    }
    return {};
}

// Функция для обновления и сохранения курсов валют в JSON файл
async function updateRates() {
    const currencies = ['usd', 'rub', 'sar', 'usdt'];
    const rates = {};

    for (let fromCurrency of currencies) {
        rates[fromCurrency] = {};
        for (let toCurrency of currencies) {
            if (fromCurrency !== toCurrency) {
                try {
                    rates[fromCurrency][toCurrency] = await getCachedFiatExchangeRate(fromCurrency, toCurrency);
                } catch (error) {
                    console.error(`Ошибка при получении курса для ${fromCurrency} к ${toCurrency}:`, error);
                }
            }
        }
    }

    // Сохранение курсов в JSON файл
    fs.writeFileSync('exchangeRates.json', JSON.stringify(rates, null, 2));
    console.log('Курсы валют обновлены и сохранены в exchangeRates.json');
}

// Запускаем обновление курсов каждые 30 минут
cron.schedule('*/30 * * * *', updateRates);

// Обновляем курсы сразу после запуска бота
updateRates();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Команда /start
bot.start((ctx) => {
    ctx.reply(`Привет! Я бот для расчета прибыли от оборота валют и конвертации валют.
Мои команды:
/profit - рассчитать прибыль RUB -> USDT -> SAR -> RUB
/rates - получить актуальные курсы валют
/convert - конвертировать валюты
/help - инструкция по использованию бота`);
});

// Команда /help
bot.help((ctx) => {
    ctx.reply(`Инструкция по использованию бота:
1) /profit <сумма_RUB> <курс_USDT_RUB> <курс_USDT_SAR> <курс_SAR_RUB> - Рассчитать прибыль от оборота RUB -> USDT -> SAR -> RUB
2) /rates - Получить актуальные курсы валют (USDT, RUB, SAR, USD)
3) /convert <сумма> <валюта_из> <валюта_в> - Конвертировать указанную сумму одной валюты в другую.`);
});

// Команда для расчета дохода (RUB -> USDT -> SAR -> RUB)
bot.command('profit', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length !== 4) {
        ctx.reply('Используйте формат: /profit <сумма_RUB> <курс_USDT_RUB> <курс_USDT_SAR> <курс_SAR_RUB>');
        return;
    }

    const [initialRub, rateUsdtRub, rateUsdtSar, rateSarRub] = args.map(Number);

    if (isNaN(initialRub) || isNaN(rateUsdtRub) || isNaN(rateUsdtSar) || isNaN(rateSarRub)) {
        ctx.reply('Пожалуйста, введите корректные числовые значения.');
        return;
    }

    const usdtAmount = initialRub / rateUsdtRub;
    const sarAmount = usdtAmount * rateUsdtSar;
    const finalRub = sarAmount * rateSarRub;

    const profit = finalRub - initialRub;
    const profitPercentage = (profit / initialRub) * 100;

    ctx.reply(`Рубли после оборота: ${finalRub.toFixed(2)} RUB
Процент прибыли: ${profitPercentage.toFixed(2)}%`);
});

// Команда для получения актуальных курсов валют
bot.command('rates', (ctx) => {
    const rates = JSON.parse(fs.readFileSync('exchangeRates.json', 'utf-8'));

    let message = 'Актуальные курсы валют:';
    for (let fromCurrency in rates) {
        message += `\n${fromCurrency.toUpperCase()}:`;
        for (let toCurrency in rates[fromCurrency]) {
            message += `  ${fromCurrency.toUpperCase()} -> ${toCurrency.toUpperCase()}: ${rates[fromCurrency][toCurrency]}`;
        }
    }

    ctx.reply(message);
});

// Команда для конвертации валют
bot.command('convert', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length !== 3) {
        ctx.reply('Используйте формат: /convert <сумма> <валюта_из> <валюта_в>');
        return;
    }

    const [amount, fromCurrency, toCurrency] = args;
    const rates = JSON.parse(fs.readFileSync('exchangeRates.json', 'utf-8'));

    const from = fromCurrency.toLowerCase();
    const to = toCurrency.toLowerCase();

    if (!rates[from] || !rates[from][to]) {
        ctx.reply('Неверные валюты. Пожалуйста, введите корректные коды валют (usdt, rub, sar, usd).');
        return;
    }

    const convertedAmount = amount * rates[from][to];
    ctx.reply(`${amount} ${fromCurrency.toUpperCase()} = ${convertedAmount.toFixed(2)} ${toCurrency.toUpperCase()}`);
});

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен!');
}).catch((err) => {
    console.error('Ошибка при запуске бота:', err);
});

require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const cron = require('node-cron');

// Функция для парсинга курса валют с Google
async function getExchangeRate(fromCurrency, toCurrency) {
    const url = `https://www.google.com/search?q=${fromCurrency}+to+${toCurrency}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const rate = $('span.DFlfde').first().text();
    return parseFloat(rate.replace(',', '.'));
}

// Функция для обновления и сохранения курсов валют в JSON файл
async function updateRates() {
    const currencies = ['usdt', 'rub', 'sar', 'usd', 'kzt'];
    const rates = {};

    for (let fromCurrency of currencies) {
        rates[fromCurrency] = {};
        for (let toCurrency of currencies) {
            if (fromCurrency !== toCurrency) {
                try {
                    rates[fromCurrency][toCurrency] = await getExchangeRate(fromCurrency, toCurrency);
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
    ctx.reply(`Привет! Я бот для расчета прибыли от оборота валют и конвертации валют.\n\n
Мои команды:\n\n
/profit - рассчитать прибыль RUB -> USDT -> SAR -> RUB\n\n
/profit_kzt - рассчитать прибыль KZT -> USDT -> SAR -> KZT\n\n
/rates - получить актуальные курсы валют\n\n
/convert - конвертировать валюты\n\n
/help - инструкция по использованию бота`);
});

// Команда /help
bot.help((ctx) => {
    ctx.reply(`Инструкция по использованию бота:\n\n
1) /profit <сумма_RUB> <курс_USDT_RUB> <курс_USDT_SAR> <курс_SAR_RUB> - Рассчитать прибыль от оборота RUB -> USDT -> SAR -> RUB\n\n
2) /profit_kzt <сумма_KZT> <курс_USDT_KZT> <курс_USDT_SAR> <курс_SAR_KZT> - Рассчитать прибыль от оборота KZT -> USDT -> SAR -> KZT\n\n
3) /rates - Получить актуальные курсы валют (USDT, RUB, SAR, USD, KZT)\n\n
4) /convert <сумма> <валюта_из> <валюта_в> - Конвертировать указанную сумму одной валюты в другую.`);
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

// Команда для расчета дохода (KZT -> USDT -> SAR -> KZT)
bot.command('profit_kzt', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length !== 4) {
        ctx.reply('Используйте формат: /profit_kzt <сумма_KZT> <курс_USDT_KZT> <курс_USDT_SAR> <курс_SAR_KZT>');
        return;
    }

    const [initialKzt, rateUsdtKzt, rateUsdtSar, rateSarKzt] = args.map(Number);

    if (isNaN(initialKzt) || isNaN(rateUsdtKzt) || isNaN(rateUsdtSar) || isNaN(rateSarKzt)) {
        ctx.reply('Пожалуйста, введите корректные числовые значения.');
        return;
    }

    const usdtAmount = initialKzt / rateUsdtKzt;
    const sarAmount = usdtAmount * rateUsdtSar;
    const finalKzt = sarAmount * rateSarKzt;

    const profit = finalKzt - initialKzt;
    const profitPercentage = (profit / initialKzt) * 100;

    ctx.reply(`Тенге после оборота: ${finalKzt.toFixed(2)} KZT
Процент прибыли: ${profitPercentage.toFixed(2)}%`);
});

// Команда для получения актуальных курсов валют
bot.command('rates', (ctx) => {
    const rates = JSON.parse(fs.readFileSync('exchangeRates.json', 'utf-8'));

    let message = 'Актуальные курсы валют:
';
    for (let fromCurrency in rates) {
        message += `${fromCurrency.toUpperCase()}:
`;
        for (let toCurrency in rates[fromCurrency]) {
            message += `  ${fromCurrency.toUpperCase()} -> ${toCurrency.toUpperCase()}: ${rates[fromCurrency][toCurrency]}
`;
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
        ctx.reply('Неверные валюты. Пожалуйста, введите корректные коды валют (usdt, rub, sar, usd, kzt).');
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

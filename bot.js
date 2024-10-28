require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Функция для получения курса валют относительно USD
async function getFiatExchangeRate(toCurrency) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${toCurrency}&vs_currencies=usd`;

    try {
        const { data } = await axios.get(url);

        if (data && data[toCurrency] && data[toCurrency].usd) {
            return data[toCurrency].usd;
        } else {
            console.error(`Курс для ${toCurrency} недоступен.`);
            return null;
        }
    } catch (error) {
        console.error(`Ошибка при получении курса для ${toCurrency}:`, error.message);
        return null;
    }
}

// Команда /start
bot.start((ctx) => {
    ctx.reply(`Привет! Я бот для расчета прибыли от оборота валют и конвертации валют.
Мои команды:
/profit - рассчитать прибыль RUB -> SAR -> RUB
/rates - получить актуальные курсы валют
/convert - конвертировать валюты
/help - инструкция по использованию бота`);
});

// Команда /help
bot.help((ctx) => {
    ctx.reply(`Инструкция по использованию бота:
1) /profit <сумма_RUB> <курс_SAR_RUB> - Рассчитать прибыль от оборота RUB -> SAR -> RUB
2) /rates - Получить актуальные курсы валют (RUB, SAR)
3) /convert <сумма> <валюта_из> <валюта_в> - Конвертировать указанную сумму одной валюты в другую.`);
});

// Команда для расчета дохода (RUB -> SAR -> RUB)
bot.command('profit', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length !== 2) {
        ctx.reply('Используйте формат: /profit <сумма_RUB> <курс_SAR_RUB>');
        return;
    }

    const [initialRub, rateSarRub] = args.map(Number);

    if (isNaN(initialRub) || isNaN(rateSarRub)) {
        ctx.reply('Пожалуйста, введите корректные числовые значения.');
        return;
    }

    // Получаем курс RUB к USD
    const rateRubUsd = await getFiatExchangeRate('rub');
    if (!rateRubUsd) {
        ctx.reply('Не удалось получить курс RUB к USD.');
        return;
    }

    // Получаем курс SAR к USD
    const rateSarUsd = await getFiatExchangeRate('sar');
    if (!rateSarUsd) {
        ctx.reply('Не удалось получить курс SAR к USD.');
        return;
    }

    const usdtAmount = initialRub / rateRubUsd; // Конвертируем RUB в USD
    const sarAmount = usdtAmount * (rateSarUsd / rateRubUsd); // Конвертируем USD в SAR
    const finalRub = sarAmount * rateRubUsd; // Возвращаемся к RUB

    const profit = finalRub - initialRub;
    const profitPercentage = (profit / initialRub) * 100;

    ctx.reply(`Рубли после оборота: ${finalRub.toFixed(2)} RUB
Процент прибыли: ${profitPercentage.toFixed(2)}%`);
});

// Команда для получения актуальных курсов валют
bot.command('rates', async (ctx) => {
    const rubToUsd = await getFiatExchangeRate('rub');
    const sarToUsd = await getFiatExchangeRate('sar');

    if (!rubToUsd || !sarToUsd) {
        ctx.reply('Не удалось получить курсы валют.');
        return;
    }

    ctx.reply(`Актуальные курсы валют относительно USD:
RUB -> USD: ${rubToUsd}
SAR -> USD: ${sarToUsd}`);
});

// Команда для конвертации валют
bot.command('convert', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length !== 3) {
        ctx.reply('Используйте формат: /convert <сумма> <валюта_из> <валюта_в>');
        return;
    }

    const [amount, fromCurrency, toCurrency] = args;
    const from = fromCurrency.toLowerCase();
    const to = toCurrency.toLowerCase();

    const fromRate = await getFiatExchangeRate(from);
    const toRate = await getFiatExchangeRate(to);

    if (fromRate === null || toRate === null) {
        ctx.reply('Неверные валюты. Пожалуйста, введите корректные коды валют (rub, sar).');
        return;
    }

    const convertedAmount = (amount * fromRate) / toRate; // Конвертируем
    ctx.reply(`${amount} ${fromCurrency.toUpperCase()} = ${convertedAmount.toFixed(2)} ${toCurrency.toUpperCase()}`);
});

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен!');
}).catch((err) => {
    console.error('Ошибка при запуске бота:', err);
});
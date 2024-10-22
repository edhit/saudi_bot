require('dotenv').config();
const { Telegraf } = require('telegraf');

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Хранение курсов и дохода
let exchangeRates = {
    'RUB->USDT': { buy: 0, sell: 0 },
    'USDT->SAR': { buy: 0, sell: 0 },
    'SAR->RUB': { buy: 0, sell: 0 }
};

let totalIncome = 0;  // Переменная для хранения общего дохода

// Команда для установки курсов
bot.command('setrate', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 5) {
        ctx.reply('Используйте: /setrate <валюта1> <валюта2> <курс_покупки> <курс_продажи>');
        return;
    }

    const fromCurrency = args[0].toUpperCase();
    const toCurrency = args[1].toUpperCase();
    const buyRate = parseFloat(args[2]);
    const sellRate = parseFloat(args[4]);

    const key = `${fromCurrency}->${toCurrency}`;

    if (exchangeRates[key]) {
        exchangeRates[key] = { buy: buyRate, sell: sellRate };
        ctx.reply(`Курс для ${key} установлен:\nПокупка: ${buyRate}\nПродажа: ${sellRate}`);
    } else {
        ctx.reply(`Неверная пара валют: ${fromCurrency} -> ${toCurrency}`);
    }
});

// Команда для покупки (RUB -> USDT)
bot.command('buy', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 1) {
        ctx.reply('Используйте: /buy <сумма>');
        return;
    }

    const amount = parseFloat(args[0]);
    const buyRate = exchangeRates['RUB->USDT'].buy;
    if (buyRate > 0) {
        const spent = amount * buyRate;
        ctx.reply(`Вы купили ${amount} USDT за ${spent.toFixed(2)} RUB`);
    } else {
        ctx.reply(`Курс покупки RUB -> USDT не установлен.`);
    }
});

// Команда для продажи (USDT -> SAR)
bot.command('sell_usdt', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 1) {
        ctx.reply('Используйте: /sell_usdt <сумма>');
        return;
    }

    const amount = parseFloat(args[0]);
    const sellRate = exchangeRates['USDT->SAR'].sell;
    if (sellRate > 0) {
        const earned = amount * sellRate;
        totalIncome += earned;  // Увеличиваем общий доход
        ctx.reply(`Вы продали ${amount} USDT за ${earned.toFixed(2)} SAR`);
    } else {
        ctx.reply(`Курс продажи USDT -> SAR не установлен.`);
    }
});

// Команда для продажи (SAR -> RUB)
bot.command('sell_sar', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 1) {
        ctx.reply('Используйте: /sell_sar <сумма>');
        return;
    }

    const amount = parseFloat(args[0]);
    const sellRate = exchangeRates['SAR->RUB'].sell;
    if (sellRate > 0) {
        const earned = amount * sellRate;
        totalIncome += earned;  // Увеличиваем общий доход
        ctx.reply(`Вы продали ${amount} SAR за ${earned.toFixed(2)} RUB`);
    } else {
        ctx.reply(`Курс продажи SAR -> RUB не установлен.`);
    }
});

// Команда для просмотра текущих курсов
bot.command('rates', (ctx) => {
    let ratesMessage = 'Текущие курсы валют:\n';
    
    for (const [key, value] of Object.entries(exchangeRates)) {
        ratesMessage += `${key}: Покупка = ${value.buy}, Продажа = ${value.sell}\n`;
    }

    ctx.reply(ratesMessage);
});

// Команда для просмотра общего дохода
bot.command('income', (ctx) => {
    ctx.reply(`Общий доход от операций: ${totalIncome.toFixed(2)} SAR`);
});

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен!');
}).catch((err) => {
    console.error('Ошибка при запуске бота:', err);
});

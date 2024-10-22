require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Хранение курсов и дохода
let exchangeRates = {
    'RUB->USDT': { buy: 0, sell: 0 },
    'USDT->SAR': { buy: 0, sell: 0 },
    'SAR->RUB': { buy: 0, sell: 0 }
};

let totalIncome = 0;  // Переменная для хранения общего дохода

// Команда для установки курсов
bot.onText(/\/setrate (\w+) (\w+) (\d+(\.\d+)?) (\d+(\.\d+)?)/, (msg, match) => {
    const chatId = msg.chat.id;
    const fromCurrency = match[1].toUpperCase();
    const toCurrency = match[2].toUpperCase();
    const buyRate = parseFloat(match[3]);
    const sellRate = parseFloat(match[5]);

    const key = `${fromCurrency}->${toCurrency}`;

    if (exchangeRates[key]) {
        exchangeRates[key] = { buy: buyRate, sell: sellRate };
        bot.sendMessage(chatId, `Курс для ${key} установлен:\nПокупка: ${buyRate}\nПродажа: ${sellRate}`);
    } else {
        bot.sendMessage(chatId, `Неверная пара валют: ${fromCurrency} -> ${toCurrency}`);
    }
});

// Команда для покупки (RUB -> USDT)
bot.onText(/\/buy (\d+(\.\d+)?)/, (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);

    const buyRate = exchangeRates['RUB->USDT'].buy;
    if (buyRate > 0) {
        const spent = amount * buyRate;
        bot.sendMessage(chatId, `Вы купили ${amount} USDT за ${spent.toFixed(2)} RUB`);
    } else {
        bot.sendMessage(chatId, `Курс покупки RUB -> USDT не установлен.`);
    }
});

// Команда для продажи (USDT -> SAR)
bot.onText(/\/sell_usdt (\d+(\.\d+)?)/, (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);

    const sellRate = exchangeRates['USDT->SAR'].sell;
    if (sellRate > 0) {
        const earned = amount * sellRate;
        totalIncome += earned;  // Увеличиваем общий доход
        bot.sendMessage(chatId, `Вы продали ${amount} USDT за ${earned.toFixed(2)} SAR`);
    } else {
        bot.sendMessage(chatId, `Курс продажи USDT -> SAR не установлен.`);
    }
});

// Команда для продажи (SAR -> RUB)
bot.onText(/\/sell_sar (\d+(\.\d+)?)/, (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseFloat(match[1]);

    const sellRate = exchangeRates['SAR->RUB'].sell;
    if (sellRate > 0) {
        const earned = amount * sellRate;
        totalIncome += earned;  // Увеличиваем общий доход
        bot.sendMessage(chatId, `Вы продали ${amount} SAR за ${earned.toFixed(2)} RUB`);
    } else {
        bot.sendMessage(chatId, `Курс продажи SAR -> RUB не установлен.`);
    }
});

// Команда для просмотра текущих курсов
bot.onText(/\/rates/, (msg) => {
    const chatId = msg.chat.id;
    let ratesMessage = 'Текущие курсы валют:\n';
    
    for (const [key, value] of Object.entries(exchangeRates)) {
        ratesMessage += `${key}: Покупка = ${value.buy}, Продажа = ${value.sell}\n`;
    }

    bot.sendMessage(chatId, ratesMessage);
});

// Команда для просмотра общего дохода
bot.onText(/\/income/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Общий доход от операций: ${totalIncome.toFixed(2)} SAR`);
});
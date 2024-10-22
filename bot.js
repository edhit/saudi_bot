require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Команда для расчета дохода
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

    // Шаг 1: Покупаем USDT за RUB
    const usdtAmount = initialRub / rateUsdtRub;

    // Шаг 2: Продаем USDT за SAR
    const sarAmount = usdtAmount * rateUsdtSar;

    // Шаг 3: Продаем SAR за RUB
    const finalRub = sarAmount * rateSarRub;

    // Вычисляем прибыль
    const profit = finalRub - initialRub;
    const profitPercentage = (profit / initialRub) * 100;

    // Вывод результата
    ctx.reply(`Рубли после оборота: ${finalRub.toFixed(2)} RUB\nПроцент прибыли: ${profitPercentage.toFixed(2)}%`);
});

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен!');
}).catch((err) => {
    console.error('Ошибка при запуске бота:', err);
});
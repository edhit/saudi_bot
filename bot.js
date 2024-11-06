require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Хранилище для предварительных сообщений и групп
let pendingMessages = {};

// Обработчик команды /send для создания предварительного сообщения с кастомным текстом
bot.command('send', async (ctx) => {
    try {
        const [command, groupName, webAppUrl, ...customTexts] = ctx.message.text.split(' ');

        if (!groupName || !webAppUrl) {
            return ctx.reply('Пожалуйста, укажите название группы, ссылку на web_app и при необходимости текст описания и кнопки. Пример: /send GroupName https://your-web-app-url.com "Описание кнопки" "Текст кнопки"');
        }

        // Разбор дополнительных параметров
        const description = customTexts[0] ? customTexts[0].replace(/"/g, '') : 'Откройте форму, нажав на кнопку ниже:';
        const buttonText = customTexts[1] ? customTexts[1].replace(/"/g, '') : 'Открыть форму';

        // Сохраняем данные в памяти
        pendingMessages[ctx.from.id] = { groupName, webAppUrl, description, buttonText };

        // Создаем сообщение с кнопкой
        await ctx.reply(description, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: buttonText,
                            url: webAppUrl
                        }
                    ]
                ]
            }
        });

        // Запрос на подтверждение отправки
        await ctx.reply('Если сообщение выглядит правильно, подтвердите отправку, нажав на кнопку ниже.', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Подтвердить отправку', callback_data: 'confirm_send' },
                        { text: 'Отменить', callback_data: 'cancel_send' }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error('Ошибка при создании предварительного сообщения:', error);
        ctx.reply('Произошла ошибка при создании сообщения.');
    }
});

// Обработчик подтверждения отправки
bot.action('confirm_send', async (ctx) => {
    try {
        const pending = pendingMessages[ctx.from.id];

        if (!pending) {
            return ctx.reply('Нет сообщения для подтверждения.');
        }

        // Отправка сообщения в группу
        await ctx.telegram.sendMessage(
            `@${pending.groupName}`,
            pending.description,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: pending.buttonText,
                                url: pending.webAppUrl
                            }
                        ]
                    ]
                }
            }
        );

        // Очищаем временные данные и подтверждаем отправку
        delete pendingMessages[ctx.from.id];
        ctx.reply('Сообщение успешно отправлено в группу.');
    } catch (error) {
        console.error('Ошибка при отправке сообщения в группу:', error);
        ctx.reply('Не удалось отправить сообщение в группу.');
    }
});

bot.action('cancel_send', (ctx) => {
    delete pendingMessages[ctx.from.id];
    ctx.reply('Отправка сообщения отменена.');
});

// Запуск бота
bot.launch()
    .then(() => console.log('Бот запущен'))
    .catch(err => console.error('Ошибка при запуске бота:', err));

// Остановка gracefully при завершении программы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

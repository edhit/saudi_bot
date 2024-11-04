require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Хранилище для предварительных сообщений и групп
let pendingMessages = {};

// Обработчик команды /send для создания предварительного сообщения
bot.command('send', async (ctx) => {
    try {
        const [command, groupName, webAppUrl] = ctx.message.text.split(' ');

        if (!groupName || !webAppUrl) {
            return ctx.reply('Пожалуйста, укажите название группы и ссылку на web_app. Пример: /send GroupName https://your-web-app-url.com');
        }

        // Создаем сообщение с кнопкой для предварительного просмотра
        const previewMessage = `Предварительное сообщение для группы "${groupName}":\n\nОткройте форму, нажав на кнопку ниже:`;
        pendingMessages[ctx.from.id] = { groupName, webAppUrl };

        await ctx.reply(previewMessage, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Открыть форму',
                            web_app: { url: webAppUrl }
                        }
                    ]
                ]
            }
        });

        // Отправляем запрос на подтверждение
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

// Обработчик нажатий на кнопки подтверждения или отмены
bot.action('confirm_send', async (ctx) => {
    try {
        const pending = pendingMessages[ctx.from.id];

        if (!pending) {
            return ctx.reply('Нет сообщения для подтверждения.');
        }

        // Отправка сообщения в группу
        await ctx.telegram.sendMessage(
            `@${pending.groupName}`, // Укажите, чтобы бот знал, что это чат с названием группы
            'Откройте форму, нажав на кнопку ниже:',
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Открыть форму',
                                web_app: { url: pending.webAppUrl }
                            }
                        ]
                    ]
                }
            }
        );

        // Очищаем временное хранилище и подтверждаем отправку
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
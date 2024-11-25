require('dotenv').config();
const {
    Telegraf,
    Markup
} = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

// Хранилище для загруженных медиа, сообщений и кнопок
let mediaStorage = {};
let pendingMessages = {};

// Middleware для фильтрации сообщений по типу чата
bot.use(async (ctx, next) => {
    if (ctx.message && ctx.chat) {
        if (ctx.chat.type === 'private') {
            ctx.isPrivate = true; // Личный чат
        } else if (['group', 'supergroup'].includes(ctx.chat.type)) {
            ctx.isGroup = true; // Групповой чат
        }
    }
    return next();
});

// Обработка загрузки фото
bot.on('photo', async (ctx) => {
    try {
        const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        mediaStorage[ctx.from.id] = {
            type: 'photo',
            fileId: photo
        };
        await ctx.reply('Фото загружено. Теперь используйте команду /send, чтобы отправить его в группу.');
    } catch (error) {
        console.error('Ошибка при загрузке фото:', error);
        ctx.reply('Не удалось загрузить фото. Попробуйте снова.');
    }
});

// Обработка загрузки видео
bot.on('video', async (ctx) => {
    try {
        const video = ctx.message.video.file_id;
        mediaStorage[ctx.from.id] = {
            type: 'video',
            fileId: video
        };
        await ctx.reply('Видео загружено. Теперь используйте команду /send, чтобы отправить его в группу.');
    } catch (error) {
        console.error('Ошибка при загрузке видео:', error);
        ctx.reply('Не удалось загрузить видео. Попробуйте снова.');
    }
});

// Обработка команды /send
bot.command('send', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const [command, groupName, webAppUrl] = args;

    if (!groupName || !webAppUrl) {
        return ctx.reply(
            'Пожалуйста, укажите название группы и ссылку на web_app.\n' +
            'Пример: /send GroupName https://your-web-app-url.com'
        );
    }

    const media = mediaStorage[ctx.from.id];
    if (!media) {
        return ctx.reply('Вы не загрузили медиа. Пожалуйста, сначала отправьте фото или видео, а затем используйте команду /send.');
    }

    pendingMessages[ctx.from.id] = {
        groupName,
        webAppUrl,
        media
    };
    return ctx.reply('Введите текст для сообщения:');
});

// Обработка сообщений от пользователей (личный чат)
bot.on('text', async (ctx, next) => {
    if (ctx.isPrivate) {
        try {
            const pending = pendingMessages[ctx.from.id];

            // Если сообщения в процессе отправки нет, ничего не делаем
            if (!pending || pending.messageText) return;

            // Если текст сообщения еще не задан, сохраняем его и просим текст для кнопки
            if (!pending.messageText) {
                pendingMessages[ctx.from.id].messageText = ctx.message.text;
                return ctx.reply('Введите название кнопки:');
            }

            // Если текст кнопки еще не задан, сохраняем его
            if (!pending.buttonText) {
                pendingMessages[ctx.from.id].buttonText = ctx.message.text;

                const {
                    media,
                    messageText,
                    buttonText,
                    webAppUrl
                } = pending;

                // Показываем предварительное сообщение
                if (media.type === 'photo') {
                    await ctx.replyWithPhoto(media.fileId, {
                        caption: messageText,
                        reply_markup: Markup.inlineKeyboard([
                            [Markup.button.url(buttonText, webAppUrl)]
                        ])
                    });
                } else if (media.type === 'video') {
                    await ctx.replyWithVideo(media.fileId, {
                        caption: messageText,
                        reply_markup: Markup.inlineKeyboard([
                            [Markup.button.url(buttonText, webAppUrl)]
                        ])
                    });
                }

                // Кнопки подтверждения
                await ctx.reply('Если сообщение выглядит правильно, подтвердите отправку, нажав на кнопку ниже.', {
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback('Подтвердить отправку', 'confirm_send')],
                        [Markup.button.callback('Отменить', 'cancel_send')]
                    ])
                });
            }
        } catch (error) {
            console.error('Ошибка при обработке личного сообщения:', error);
        }
    } else {
        return next(); // Передаем управление следующему обработчику
    }
});

// Обработка сообщений из групп
bot.on('text', async (ctx) => {
    if (ctx.isGroup) {
        try {
            await ctx.reply(
                `Вы отправили сообщение в группе "${ctx.chat.title}":\n"${ctx.message.text}"`, {
                    reply_to_message_id: ctx.message.message_id
                } // Отвечаем на сообщение
            );
        } catch (error) {
            console.error('Ошибка при обработке сообщения из группы:', error);
        }
    }
});

// Подтверждение отправки
bot.action('confirm_send', async (ctx) => {
    try {
        const pending = pendingMessages[ctx.from.id];
        if (!pending) {
            return ctx.reply('Нет сообщения для подтверждения.');
        }

        const {
            groupName,
            media,
            messageText,
            buttonText,
            webAppUrl
        } = pending;

        // Отправка сообщения в группу
        if (media.type === 'photo') {
            await ctx.telegram.sendPhoto(`@${groupName}`, media.fileId, {
                caption: messageText,
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.url(buttonText, webAppUrl)]
                ])
            });
        } else if (media.type === 'video') {
            await ctx.telegram.sendVideo(`@${groupName}`, media.fileId, {
                caption: messageText,
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.url(buttonText, webAppUrl)]
                ])
            });
        }

        await ctx.reply('Сообщение успешно отправлено в группу.');

        // Очищаем временные данные
        delete mediaStorage[ctx.from.id];
        delete pendingMessages[ctx.from.id];
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        ctx.reply('Не удалось отправить сообщение. Попробуйте снова.');
    }
});

// Отмена отправки
bot.action('cancel_send', async (ctx) => {
    delete pendingMessages[ctx.from.id];
    await ctx.reply('Отправка сообщения отменена.');
});

// Запуск бота
bot.launch()
    .then(() => console.log('Бот запущен и готов к работе!'))
    .catch((err) => console.error('Ошибка при запуске бота:', err));

// Остановка gracefully при завершении программы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

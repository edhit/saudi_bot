const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Хранилище сообщений, ожидающих отправки
let pendingMessages = {};

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

  // Сохраняем данные о группе и ссылке
  pendingMessages[ctx.from.id] = {
    groupName,
    webAppUrl,
    messageText: null,
    buttonText: null,
  };

  return ctx.reply('Введите текст для сообщения:');
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    const pending = pendingMessages[ctx.from.id];

    // Если нет активного сообщения, ничего не делаем
    if (!pending) return;

    // Если текст сообщения ещё не задан, сохраняем его
    if (!pending.messageText) {
      pendingMessages[ctx.from.id].messageText = ctx.message.text;
      return ctx.reply('Введите название кнопки:');
    }

    // Если текст кнопки ещё не задан, сохраняем его
    if (!pending.buttonText) {
      pendingMessages[ctx.from.id].buttonText = ctx.message.text;

      const { groupName, messageText, buttonText, webAppUrl } = pendingMessages[ctx.from.id];

      // Показываем предварительное сообщение
      await ctx.reply(messageText, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url(buttonText, webAppUrl)],
        ]),
      });

      // Предлагаем подтвердить или отменить
      await ctx.reply('Если сообщение выглядит правильно, подтвердите отправку, нажав на кнопку ниже.', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Подтвердить отправку', 'confirm_send')],
          [Markup.button.callback('Отменить', 'cancel_send')],
        ]),
      });
    }
  } catch (error) {
    console.error('Ошибка при обработке текста:', error);
    await ctx.reply('Произошла ошибка. Попробуйте снова.');
  }
});

// Подтверждение отправки
bot.action('confirm_send', async (ctx) => {
  try {
    const pending = pendingMessages[ctx.from.id];
    if (!pending) {
      return ctx.reply('Нет сообщения для подтверждения.');
    }

    const { groupName, messageText, buttonText, webAppUrl } = pending;

    // Отправка сообщения в группу
    await ctx.telegram.sendMessage(`@${groupName}`, messageText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: buttonText, url: webAppUrl }],
        ],
      },
    });

    await ctx.reply('Сообщение успешно отправлено в группу.');

    // Очищаем временные данные
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
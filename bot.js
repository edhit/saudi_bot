const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Хранилище сообщений
let pendingMessages = {};

// Команда /send
bot.command('send', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const [command, groupName, webAppUrl] = args;

  if (!groupName || !webAppUrl) {
    return ctx.reply(
      'Пожалуйста, укажите название группы и ссылку на web_app.\n' +
      'Пример: /send GroupName https://your-web-app-url.com'
    );
  }

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
  const pending = pendingMessages[ctx.from.id];

  // Если нет ожидающего сообщения
  if (!pending) return;

  // Записываем текст сообщения
  if (!pending.messageText) {
    pending.messageText = ctx.message.text;
    return ctx.reply('Введите название кнопки:');
  }

  // Записываем текст кнопки
  if (!pending.buttonText) {
    pending.buttonText = ctx.message.text;

    // Предварительный просмотр
    await ctx.reply(pending.messageText, {
      reply_markup: {
        inline_keyboard: [[{ text: pending.buttonText, url: pending.webAppUrl }]],
      },
    });

    // Подтверждение
    await ctx.reply('Если сообщение выглядит правильно, подтвердите отправку.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Подтвердить отправку', callback_data: 'confirm_send' }],
          [{ text: 'Отменить', callback_data: 'cancel_send' }],
        ],
      },
    });
  }
});

// Подтверждение отправки
bot.action('confirm_send', async (ctx) => {
  const pending = pendingMessages[ctx.from.id];
  if (!pending) return ctx.reply('Нет сообщения для подтверждения.');

  const { groupName, messageText, buttonText, webAppUrl } = pending;

  try {
    // Отправка сообщения с кнопкой в группу
    await ctx.telegram.sendMessage(`@${groupName}`, messageText, {
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, url: webAppUrl }]],
      },
    });

    await ctx.reply('Сообщение успешно отправлено в группу.');

    // Очистка временных данных
    delete pendingMessages[ctx.from.id];
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    ctx.reply('Не удалось отправить сообщение. Проверьте название группы или права доступа бота.');
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
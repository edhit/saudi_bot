const { Telegraf } = require('telegraf');
const Redis = require('ioredis');
const winston = require('winston');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const lang = {
  en: {
    media_added: 'Media added.',
    start: '⚠️ Add the bot to the group as an admin to send a message.\n\nEnter the group link or group name:',
    groupName: 'Enter link group or group name:',
    webAppUrl: 'Enter link for button:',
    messageText: 'Enter the message text:',
    buttonText: 'Enter the button text:',
    link_or_username: 'Enter link group or group name:\nhttps://t.me/sendbuttonongroup_bot or @sendbuttonongroup_bot',
    link: 'Enter link:\nhttps://t.me/sendbuttonongroup_bot',
    no_preview: 'No message found to preview.',
    check_message: 'If the message looks correct, confirm sending it.',
    ok: 'The message has been successfully sent to the group.',
    permissions: 'Failed to send the message. Check the group name or bot permissions.',
    cancel: 'Message sending canceled.',
    error: 'An error occurred. Please try again.',
    btn_confirm: 'Confirm',
    btn_cancel: 'Cancel'
  },
  ru: {
    media_added: 'Медиа добавлено.',
    start: '⚠️ Добавьте бота в группу как админ, чтобы отправить сообщение.\n\nВведите ссылку на группу или имя группы:',
    groupName: 'Введите ссылку на группу или имя группы:',
    webAppUrl: 'Введите ссылку для кнопки:',
    messageText: 'Введите текст сообщения:',
    buttonText: 'Введите текст кнопки:',
    link_or_username: 'Введите ссылку на группу или имя группы:\nhttps://t.me/sendbuttonongroup_bot или @sendbuttonongroup_bot',
    link: 'Отправь ссылку:\nhttps://t.me/sendbuttonongroup_bot',
    no_preview: 'Сообщение для предпросмотра не найдено.',
    check_message: 'Если сообщение выглядит правильно, подтвердите его отправку.',
    ok: 'Сообщение успешно отправлено в группу.',
    permissions: 'Не удалось отправить сообщение. Проверьте имя группы или разрешения бота.',
    cancel: 'Отправка сообщения отменена.',
    error: 'Произошла ошибка. Пожалуйста, попробуйте снова.',
    btn_confirm: 'Подтвердить',
    btn_cancel: 'Отменить'
  },
  ar: {
    media_added: 'تم إضافة الوسائط.',
    start: '⚠️ أضف البوت إلى المجموعة كمسؤول لإرسال الرسالة.\n\nأدخل رابط المجموعة أو اسم المجموعة:',
    groupName: 'أدخل رابط المجموعة أو اسم المجموعة:',
    webAppUrl: 'أدخل رابط الزر:',
    messageText: 'أدخل نص الرسالة:',
    buttonText: 'أدخل نص الزر:',
    link_or_username: 'أدخل رابط المجموعة أو اسم المجموعة:\nhttps://t.me/sendbuttonongroup_bot أو @sendbuttonongroup_bot',
    link: 'أدخل الرابط:\nhttps://t.me/sendbuttonongroup_bot',
    no_preview: 'لم يتم العثور على رسالة للمعاينة.',
    check_message: 'إذا كانت الرسالة تبدو صحيحة، قم بتأكيد الإرسال.',
    ok: 'تم إرسال الرسالة إلى المجموعة بنجاح.',
    permissions: 'فشل في إرسال الرسالة. تحقق من اسم المجموعة أو أذونات البوت.',
    cancel: 'تم إلغاء إرسال الرسالة.',
    error: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
    btn_confirm: 'تأكيد',
    btn_cancel: 'إلغاء'
  }  
};

const defaultLanguage = 'en'; // Язык по умолчанию

const getLangText = (langCode, keys) => {
  let result = lang[langCode];
  
  for (const key of keys) {
    if (!result || !(key in result)) {
      return null; // Вернуть `null`, если ключ отсутствует
    }
    result = result[key];
  }
  
  return result;
};

const privateChatMiddleware = async (ctx, next) => {
  const chatType = ctx.chat?.type;

  if (chatType === "private") {
    // Если чат личный, продолжаем обработку
    await next();
  } else return;
};

const languageMiddleware = (ctx, next) => {
  try {
    // Получаем язык из контекста
    const userLanguage = ctx.from?.language_code || defaultLanguage;

    // Сохраняем язык в контексте
    ctx.state.language = (["ru", "en"].includes(userLanguage))? userLanguage:defaultLanguage;

    // Переходим к следующему middleware
    return next();
  } catch (error) {
    ctx.state.language = defaultLanguage; // Устанавливаем язык по умолчанию в случае ошибки
    return next();
  }
};

// Redis setup
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
});

// Winston logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'bot.log' }),
  ],
});

// Function to manage pending messages in Redis
async function setPendingMessage(userId, data) {
  await redis.setex(`pending:${userId}`, 3600, JSON.stringify(data)); // Expiration of 1 hour
}

async function getPendingMessage(userId) {
  const data = await redis.get(`pending:${userId}`);
  return data ? JSON.parse(data) : null;
}

async function deletePendingMessage(userId) {
  await redis.del(`pending:${userId}`);
}

// Function to preview the message
async function preview(ctx) {
  try {
    const pending = await getPendingMessage(ctx.from.id);

    if (!pending) {
      return ctx.reply(`${getLangText(ctx.state.language, ['preview'])}`);
    }

    // Preview message
    if (pending.media) {
      if (pending.mediaType === 'photo') {
        await ctx.telegram.sendPhoto(ctx.chat.id, pending.media, {
          entities: pending.messageText.entities,
          caption: pending.messageText.text,
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: pending.buttonText, url: pending.webAppUrl }]],
          },
        });
      } else if (pending.mediaType === 'video') {
        await ctx.telegram.sendVideo(ctx.chat.id, pending.media, {
          entities: pending.messageText.entities,
          caption: pending.messageText.text,
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: pending.buttonText, url: pending.webAppUrl }]],
          },
        });
      }
    } else {
      await ctx.telegram.sendMessage(ctx.chat.id, pending.messageText.text, {
        entities: pending.messageText.entities,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: pending.buttonText, url: pending.webAppUrl }]],
        },
      });
    }

    await ctx.reply(`${getLangText(ctx.state.language, ['check_message'])}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `${getLangText(ctx.state.language, ['btn_confirm'])}`, callback_data: 'confirm_send' }],
          [{ text: `${getLangText(ctx.state.language, ['btn_cancel'])}`, callback_data: 'cancel_send' }],
        ],
      },
    });
  } catch (error) {
    logger.error('Error during preview:', error);
    ctx.reply(`${getLangText(ctx.state.language, ['error'])}\n\n ${error.message}`);
  }
}

async function checkStringType(input) {
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+\.[a-z\.]{2,6}|localhost)([\/\w \.-]*)*\/?$/i;
  const usernameRegex = /^@[a-zA-Z0-9_]{5,}$/;

  if (urlRegex.test(input)) {
    return 'link'; // Это ссылка
  } else if (usernameRegex.test(input)) {
    return 'username'; // Это имя пользователя
  } else {
    return 'unknown'; // Неизвестный формат
  }
}


// Command /start
bot.command('start', privateChatMiddleware, languageMiddleware, async (ctx) => {

  // await preview(ctx)
  // return
  // const pending = await getPendingMessage(ctx.from.id);

  // await ctx.telegram.sendMessage(ctx.chat.id, pending.messageText.text, {
  //   entities: pending.messageText.entities
  // });
  // return
  // return
  
  try {
    ctx.reply(getLangText(ctx.state.language, ['start']));

    await setPendingMessage(ctx.from.id, {
      groupName: null,
      webAppUrl: null,
      messageText: null,
      buttonText: null,
      media: null,
      mediaType: null,
    });

  } catch (error) {
    logger.error('Error in /start command:', error);
    ctx.reply(getLangText(ctx.state.language, ['error']));
  }
});

// Handle text messages and media
bot.on('message', privateChatMiddleware, languageMiddleware, async (ctx) => {

  try {
    const pending = await getPendingMessage(ctx.from.id);

    if (!pending) return;

    // Handle media
    if (!pending.media && (ctx.message.photo || ctx.message.video)) {
      pending.media = ctx.message.photo
        ? ctx.message.photo[ctx.message.photo.length - 1].file_id
        : ctx.message.video.file_id;
      pending.mediaType = ctx.message.photo ? 'photo' : 'video';
      await setPendingMessage(ctx.from.id, pending);


      if (!pending.groupName) {
        return ctx.reply(`${getLangText(ctx.state.language, ['media_added'])} ${getLangText(ctx.state.language, ['groupName'])}`);
      }
      if (!pending.webAppUrl) {
        return ctx.reply(`${getLangText(ctx.state.language, ['media_added'])} ${getLangText(ctx.state.language, ['webAppUrl'])}`);
      }
      if (!pending.messageText) {
        return ctx.reply(`${getLangText(ctx.state.language, ['media_added'])} ${getLangText(ctx.state.language, ['messageText'])}`);
      }
      if (!pending.buttonText) {
        return ctx.reply(`${getLangText(ctx.state.language, ['media_added'])} ${getLangText(ctx.state.language, ['buttonText'])}`);
      }
    }

    // Save group name
    if (!pending.groupName) {
      const link_username = await checkStringType(ctx.message.text);
      if (link_username !== 'link' && link_username !== 'username') return ctx.reply(`${getLangText(ctx.state.language, ['link_or_username'])}`);
      pending.groupName = ctx.message.text;
      await setPendingMessage(ctx.from.id, pending);
      return ctx.reply(`${getLangText(ctx.state.language, ['webAppUrl'])}`);
    }

    // Save group name
    if (!pending.webAppUrl) {
      const link_username = await checkStringType(ctx.message.text);
      if (link_username !== 'link') return ctx.reply(`${getLangText(ctx.state.language, ['link'])}`);
      pending.webAppUrl = ctx.message.text;
      await setPendingMessage(ctx.from.id, pending);
      return ctx.reply(`${getLangText(ctx.state.language, ['messageText'])}`);
    }


    // Save message text
    if (!pending.messageText) {
      pending.messageText = ctx.message;
      await setPendingMessage(ctx.from.id, pending);
      return ctx.reply(`${getLangText(ctx.state.language, ['buttonText'])}`);
    }

    // Save button text
    if (!pending.buttonText) {     
      pending.buttonText = ctx.message.text;
      await setPendingMessage(ctx.from.id, pending);
      await preview(ctx);
    }
  } catch (error) {
    logger.error('Error handling message:', error);
    deletePendingMessage(ctx.from.id);
    ctx.reply(`${getLangText(ctx.state.language, ['error'])}`);
  }
});


// Confirm sending the message
bot.action('confirm_send', privateChatMiddleware, languageMiddleware, async (ctx) => {
  try {
    const pending = await getPendingMessage(ctx.from.id);
    if (!pending) return ctx.reply(`${getLangText(ctx.state.language, ['check_message'])} `);

    const { groupName, messageText, buttonText, webAppUrl, media, mediaType } = pending;
    
    if (media) {
      if (mediaType === 'photo') {
        await ctx.telegram.sendPhoto(`${groupName}`, media, {
          caption: messageText.text,
          entities: messageText.entities,
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, url: webAppUrl }]],
          },
        });
      } else if (mediaType === 'video') {
        await ctx.telegram.sendVideo(`${groupName}`, media, {
          caption: messageText.text,
          entities: messageText.entities,
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, url: webAppUrl }]],
          },
        });
      }
    } else {
      await ctx.telegram.sendMessage(`${groupName}`, messageText.text, {
        entities: messageText.entities,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: buttonText, url: webAppUrl }]],
        },
      });
    }

    await ctx.editMessageText(`${getLangText(ctx.state.language, ['ok'])}`);

    // Clear temporary data
    await deletePendingMessage(ctx.from.id);
  } catch (error) {
    await deletePendingMessage(ctx.from.id);
    ctx.editMessageText(`${getLangText(ctx.state.language, ['permissions'])} `);
  }
});

// Cancel sending the message
bot.action('cancel_send', privateChatMiddleware, languageMiddleware, async (ctx) => {
  try {
    await deletePendingMessage(ctx.from.id);
    ctx.editMessageText(`${getLangText(ctx.state.language, ['cancel'])}`);
  } catch (error) {
    logger.error('Error canceling send:', error);
    ctx.reply(`${getLangText(ctx.state.language, ['error'])}`);
  }
});

// Launch the bot
bot.launch()
  .then(() => logger.info('Bot started and ready!'))
  .catch((err) => logger.error('Error starting the bot:', err));

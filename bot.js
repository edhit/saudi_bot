const { Telegraf } = require('telegraf');
const Redis = require('ioredis');
const winston = require('winston');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

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
      return ctx.reply('No message found to preview.');
    }

    // Preview message
    if (pending.media) {
      if (pending.mediaType === 'photo') {
        await ctx.replyWithPhoto(pending.media, {
          caption: pending.messageText,
          reply_markup: {
            inline_keyboard: [[{ text: pending.buttonText, url: pending.webAppUrl }]],
          },
        });
      } else if (pending.mediaType === 'video') {
        await ctx.replyWithVideo(pending.media, {
          caption: pending.messageText,
          reply_markup: {
            inline_keyboard: [[{ text: pending.buttonText, url: pending.webAppUrl }]],
          },
        });
      }
    } else {
      await ctx.reply(pending.messageText, {
        reply_markup: {
          inline_keyboard: [[{ text: pending.buttonText, url: pending.webAppUrl }]],
        },
      });
    }

    await ctx.reply('If the message looks correct, confirm sending it.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Confirm Send', callback_data: 'confirm_send' }],
          [{ text: 'Cancel', callback_data: 'cancel_send' }],
        ],
      },
    });
  } catch (error) {
    logger.error('Error during preview:', error);
    ctx.reply('An error occurred. Please try again.');
  }
}

// Command /start
bot.command('start', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ');
    const [command, groupName, webAppUrl] = args;

    if (!groupName || !webAppUrl) {
      return ctx.reply(
        'Please provide the group name and the web app link.\n' +
        'Example: /start GroupName https://your-web-app-url.com'
      );
    }

    await setPendingMessage(ctx.from.id, {
      groupName,
      webAppUrl,
      messageText: null,
      buttonText: null,
      media: null,
      mediaType: null,
    });

    ctx.reply('Enter the message text:');
  } catch (error) {
    logger.error('Error in /start command:', error);
    ctx.reply('An error occurred. Please try again.');
  }
});

// Handle text messages and media
bot.on('message', async (ctx) => {
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

      if (!pending.messageText) {
        return ctx.reply('Media added. Enter the message text:');
      }
      if (!pending.buttonText) {
        return ctx.reply('Media added. Enter the button text:');
      }
    }

    // Save message text
    if (!pending.messageText) {
      pending.messageText = ctx.message.text;
      await setPendingMessage(ctx.from.id, pending);
      return ctx.reply('Enter the button text:');
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
    ctx.reply('Something went wrong. Please try again.');
  }
});


// Confirm sending the message
bot.action('confirm_send', async (ctx) => {
  try {
    const pending = await getPendingMessage(ctx.from.id);
    if (!pending) return ctx.reply('No message to confirm.');

    const { groupName, messageText, buttonText, webAppUrl, media, mediaType } = pending;

    if (media) {
      if (mediaType === 'photo') {
        await ctx.telegram.sendPhoto(`@${groupName}`, media, {
          caption: messageText,
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, url: webAppUrl }]],
          },
        });
      } else if (mediaType === 'video') {
        await ctx.telegram.sendVideo(`@${groupName}`, media, {
          caption: messageText,
          reply_markup: {
            inline_keyboard: [[{ text: buttonText, url: webAppUrl }]],
          },
        });
      }
    } else {
      await ctx.telegram.sendMessage(`@${groupName}`, messageText, {
        reply_markup: {
          inline_keyboard: [[{ text: buttonText, url: webAppUrl }]],
        },
      });
    }

    await ctx.reply('The message has been successfully sent to the group.');

    // Clear temporary data
    await deletePendingMessage(ctx.from.id);
  } catch (error) {
    await deletePendingMessage(ctx.from.id);
    ctx.editMessageText('Failed to send the message. Check the group name or bot permissions.');
  }
});

// Cancel sending the message
bot.action('cancel_send', async (ctx) => {
  try {
    await deletePendingMessage(ctx.from.id);
    ctx.editMessageText('Message sending canceled.');
  } catch (error) {
    logger.error('Error canceling send:', error);
    ctx.reply('An error occurred while canceling. Please try again.');
  }
});

// Launch the bot
bot.launch()
  .then(() => logger.info('Bot started and ready!'))
  .catch((err) => logger.error('Error starting the bot:', err));

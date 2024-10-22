# Используем официальный образ Node.js
FROM node:18

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы в контейнер
COPY . .

# Устанавливаем переменную окружения для токена Telegram
ENV TELEGRAM_TOKEN=${TELEGRAM_TOKEN}

# Запускаем бота
CMD ["node", "bot.js"]

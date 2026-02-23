FROM oven/bun:1.3.9

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY lib ./lib
COPY middleware ./middleware
COPY tsconfig.json ./tsconfig.json

ENV NODE_ENV=production

CMD ["bun", "run", "start"]

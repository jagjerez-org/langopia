# apps/api/Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
RUN npm ci
COPY . .
RUN npm run build --workspace @langopia/db && npm run build --workspace @langopia/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
RUN npm ci --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/db/dist packages/db/dist
# Las migraciones y las políticas viajan con la imagen: se aplican al arrancar.
# `drizzle-kit migrate` necesita su config, y `db:deploy` ejecuta
# `apply-policies.ts` con tsx: ninguno de los dos sale con el `dist` compilado.
COPY --from=build /app/packages/db/drizzle packages/db/drizzle
COPY packages/db/drizzle.config.ts packages/db/drizzle.config.ts
COPY packages/db/src/policies.sql packages/db/src/policies.sql
COPY packages/db/src/apply-policies.ts packages/db/src/apply-policies.ts
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

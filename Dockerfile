# Keep this Bun in step with .github/workflows/pr.yml.
FROM oven/bun:1.2.13 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" || { echo "VITE_API_BASE_URL build arg is required" >&2; exit 1; }
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# The build number shown beside the version in Settings; the deploy passes main's commit count.
ARG VITE_APP_BUILD
ENV VITE_APP_BUILD=$VITE_APP_BUILD
RUN bun run build

FROM nginx:1.27-alpine
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

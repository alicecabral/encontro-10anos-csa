# Encontro de 10 anos

Aplicação Angular + Express/TypeScript + PostgreSQL/Prisma para inscrições com comprovantes privados no Cloudflare R2.

## Início rápido

1. Copie `.env.example` para `.env` e defina `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
2. `docker compose up -d` inicia o PostgreSQL local.
3. `npm install`
4. `npm run prisma:generate -w @encontro/api && npm run prisma:migrate -w @encontro/api && npm run prisma:seed -w @encontro/api`
5. Em terminais separados: `npm run dev:api` e `npm run dev:web`.
6. Acesse `http://localhost:4200`; administração em `/admin/login`.

## Configuração do evento

Edite `apps/api/src/event.ts` para textos, data, local, programação e PIX. Edite os lotes pelo banco/Prisma; o seed cria três lotes com preços `0` e períodos demonstrativos, portanto devem ser alterados antes de produção.

## R2 privado

Crie um bucket privado no Cloudflare R2, gere uma API token com acesso limitado ao bucket e preencha `R2_*` no `.env`. O backend envia os arquivos com chaves aleatórias e fornece URLs assinadas de 5 minutos somente a administradores autenticados. Não exponha essas credenciais ao Angular. Sem R2 configurado, o modo de desenvolvimento guarda arquivos em `apps/api/uploads/`; esse modo não deve ser usado em produção.

## Produção e segurança

Use HTTPS, `NODE_ENV=production`, um `JWT_SECRET` longo e `CORS_ORIGIN` do domínio final. Configure SMTP opcionalmente; a inscrição não depende de email. Uploads aceitam JPEG/PNG/WEBP/GIF/PDF e respeitam `MAX_UPLOAD_SIZE` (50 MB padrão). Senhas são hash bcrypt e o cookie de administração é HTTP-only.

## Verificação

Execute `npm test`. Para build: `npm run build`. Antes de publicar, substitua todos os valores `[PLACEHOLDER]`, os lotes e as credenciais de desenvolvimento.

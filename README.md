# IceBreaker

App móvel para casais que quebra o gelo quando os dois estão juntos em casa, cada um agarrado ao seu telemóvel. Envia uma pequena missão a dois (cada um recebe uma parte diferente) e depois pede que os telemóveis fiquem em baixo.

**A app tem sucesso quando é usada o mínimo possível.**

- Especificação do produto: [`docs/PRODUCT.md`](docs/PRODUCT.md)
- Regras para contribuir (incluindo o Claude Code): [`CLAUDE.md`](CLAUDE.md)

## Estrutura

```
app/             App Expo (React Native, TypeScript, expo-router)
packages/core/   Lógica pura do produto (trigger, missões), partilhada com o backend
supabase/        Base de dados, catálogo de missões e Edge Functions
docs/            Especificação do produto
```

## Desenvolvimento

Requer Node 22.

```bash
npm install
npm test            # testes de todos os pacotes
npm run lint
npm run typecheck
npm run format      # Prettier
```

A app usa módulos nativos, por isso corre num _development build_ e não no Expo Go:

```bash
cd app
npx expo run:android   # ou run:ios
```

## Backend local (Supabase)

Requer o [Supabase CLI](https://supabase.com/docs/guides/local-development) e Docker.

```bash
supabase start                 # aplica as migrações e o seed das missões
cp app/.env.example app/.env   # preencher com o URL e a anon key mostrados pelo comando acima
```

Os emails com o código de entrada aparecem no Inbucket local (http://127.0.0.1:54324).

## Notificações

As missões são enviadas pela Edge Function `trigger-mission` através do Expo Push.

```bash
npx eas-cli@latest init                       # cria o projeto EAS (projectId usado pelos push tokens)
supabase functions serve trigger-mission      # local
supabase functions deploy trigger-mission     # produção
supabase secrets set EXPO_ACCESS_TOKEN=...    # opcional, se o Expo Push exigir autenticação
```

O trigger automático (Android) usa a função `heartbeat`, que guarda só um hash do IP público:

```bash
supabase secrets set PRESENCE_IP_SECRET=$(openssl rand -hex 32)
supabase functions deploy heartbeat
supabase functions deploy report-offphone   # métrica: minutos sem telemóvel
```

## Gerar a app Android (AAB/APK)

O workflow **Android release** (GitHub Actions) gera o `.aab` (Play Store) e o `.apk` (instalar diretamente):

- **Actions → Android release → Run workflow**: os ficheiros ficam no fim da execução, em _Artifacts_.
- **Tag `v*`** (ex.: `git tag v0.1.0 && git push origin v0.1.0`): ficam também numa _Release_ do GitHub.

Secrets necessários (_Settings → Secrets and variables → Actions_):

| Secret                                                                   | O que é                                                                                                                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`                                               | URL do projeto Supabase                                                                                                                                   |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`                                          | Anon key do projeto Supabase                                                                                                                              |
| `EAS_PROJECT_ID`                                                         | ID do projeto EAS (`npx eas-cli init`), usado pelos push tokens                                                                                           |
| `GOOGLE_SERVICES_JSON`                                                   | Conteúdo do `google-services.json` do Firebase (notificações no Android)                                                                                  |
| `ANDROID_KEYSTORE_BASE64`                                                | Opcional: upload key em base64 (`base64 -w0 upload.jks`). Sem ela, a app é assinada com a chave de debug, que serve para testes mas não para a Play Store |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Opcionais: dados da upload key                                                                                                                            |

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

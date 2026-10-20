# CLAUDE.md

A especificação completa do produto está em [`docs/PRODUCT.md`](docs/PRODUCT.md). Ler antes de qualquer alteração.

## Regras de trabalho

- **Um PR por alteração.** Um PR por funcionalidade ou correção, com descrição clara do que muda e porquê.
- **Antes de começar uma fase do roadmap, propor um plano e confirmar.**
- **Sempre que uma decisão vá contra os princípios de produto (secção 1 do PRODUCT.md), parar e perguntar.** Em particular: nada de pontos, streaks, feeds, histórico visível, ecrãs de revelação, nem mais notificações do que o necessário.
- **Testar a lógica do trigger** (`packages/core`). É o coração do produto.
- **Código e nomes técnicos em inglês; textos para o utilizador em português de Portugal**, sempre através de i18n (nunca strings soltas nos componentes).
- **Linguagem neutra** nos textos: nunca assumir género do parceiro; usar `{parceiro}`.
- **Privacidade:** nunca guardar nem enviar para o backend dados de conteúdo do telemóvel (nomes de apps, tempo por app, etc.). Só sinais agregados.
- Missões: no máximo 200 caracteres por mensagem; nunca humilhar, causar ciúmes ou envolver terceiros sem saberem.

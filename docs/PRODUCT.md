# IceBreaker (nome provisório)

App móvel para casais que deteta quando os dois estão juntos em casa, cada um agarrado ao seu telemóvel, e lança uma pequena dinâmica a dois (missão secreta, piada, pergunta, desafio) para quebrar o gelo. Depois disso, a app incentiva os dois a pousarem o telemóvel.

A notificação é só o trigger. O objetivo é sempre a interação cara a cara e largar o telemóvel a seguir. **A app tem sucesso quando é usada o mínimo possível.**

## 1. Princípios de produto (não negociáveis)

- **A app existe durante segundos.** A notificação já contém a missão completa. Abrir a app é opcional.
- **Nada de loops de engagement.** Sem pontos, streaks, feeds, rankings, álbuns ou qualquer coisa que puxe o utilizador de volta para o ecrã.
- **A revelação é falada, não mostrada.** As missões terminam com instruções do tipo "pergunta-lhe o que recebeu". Não existe ecrã de revelação.
- **Cada missão acaba com "telemóveis em baixo".** Depois de uma missão, a app entra num período de silêncio (por defeito 60 min).
- **Poucas notificações.** Máximo 2 por noite, por defeito.
- **Privacidade total entre parceiros.** Nunca se mostra ao parceiro o que o outro está a fazer no telemóvel, que apps usa, nem quanto tempo. O backend só recebe sinais agregados ("em uso contínuo há mais de X min": sim/não).
- **Linguagem neutra.** Não assumir "namorado/namorada". Cada casal define como se tratam (nome, alcunha).
- **Opt-in por nível.** Missões leves por defeito; níveis mais provocadores só se os dois ativarem. Cada um tem um botão "hoje não".

## 2. Métrica principal

**Minutos sem uso de telemóvel (de ambos) após o trigger.** Medido de forma agregada, sem conteúdo.

Métricas secundárias: % de missões aceites, % de "hoje não", retenção semanal de casais ativos.

Métricas a **não** otimizar: tempo na app, sessões, aberturas.

## 3. Conceito central: missões assimétricas

Cada missão é um par de mensagens, uma para cada parceiro, enviadas quase em simultâneo. Cada um sabe apenas uma parte.

| Tipo             | Descrição                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `actor_audience` | Um faz algo (contar piada); o outro tem uma instrução secreta de reação.                             |
| `secret_mission` | Um tem um objetivo secreto (fazer o outro dizer uma palavra); o outro recebe uma pista vaga ou nada. |
| `opposing`       | Os dois têm objetivos opostos (convencer vs resistir).                                               |
| `coop`           | Cada um recebe metade de uma pergunta/enigma; só resolvem juntos.                                    |
| `kindness`       | Um faz um gesto/elogio; o outro é avisado que vem aí algo simpático.                                 |
| `decision`       | Decidir algo juntos a falar (filme, jantar, plano do fim de semana) a partir de 3 opções.            |

Cada mensagem tem no máximo ~200 caracteres para caber inteira na notificação.

Nunca incluir missões que possam humilhar, causar ciúmes ou envolver terceiros sem saberem.

## 4. Lógica do trigger

O trigger dispara quando **todas** as condições se verificam:

1. Os dois parceiros estão juntos (ver 5.2).
2. Os dois estão em uso contínuo do telemóvel há ≥ N minutos (por defeito 20, configurável).
3. Está dentro da janela horária definida pelo casal (por defeito 19h–23h30).
4. Não foram atingidas as 2 missões da noite.
5. Não estão no período de silêncio pós-missão.
6. Nenhum dos dois ativou "hoje não" nem está em modo Não Incomodar.

Quando dispara:

- O backend escolhe uma missão compatível com o nível e as preferências do casal, evitando repetidas.
- Envia as duas notificações com diferença máxima de poucos segundos.
- Inicia o período de silêncio.
- Regista, de forma agregada, quantos minutos os dois ficaram sem usar o telemóvel.

Existe também um **trigger manual**: botão "Estamos aborrecidos" que qualquer um pode carregar (MVP Fase 1).

## 5. Arquitetura técnica

### 5.1 Stack

- **App:** React Native com Expo (development build, porque precisamos de módulos nativos).
- **Backend:** Supabase (Auth, Postgres, Edge Functions, Realtime).
- **Push:** Expo Push Notifications (FCM/APNs por baixo).
- **Língua:** português de Portugal como língua base; i18n preparado desde o início.

### 5.2 Deteção de "estão juntos"

Por ordem de preferência:

1. **Mesmo IP público:** cada telemóvel envia um heartbeat ao backend; se os dois aparecem com o mesmo IP público, assume-se que estão na mesma rede de casa. Não exige permissões extra.
2. **Rede Wi-Fi de casa marcada:** opcional; o utilizador marca a rede de casa (no Android exige permissão de localização para ler o SSID; guardar só o hash).
3. **Não usar GPS contínuo.**

### 5.3 Deteção de uso do telemóvel

- **Android (primeiro alvo):** módulo nativo com `UsageStatsManager` (permissão `PACKAGE_USAGE_STATS`, ativada pelo utilizador nas definições) + eventos de ecrã ligado/desligado. Calcular localmente o tempo de uso contínuo e enviar só um booleano/minutos ao backend.
- **iOS (fase posterior):** Screen Time API (FamilyControls, DeviceActivity). Exige pedido de entitlement à Apple e uma extensão nativa em Swift. Os dados ficam no dispositivo; usar `DeviceActivityMonitor` com thresholds para acordar a app. Investigar viabilidade antes de comprometer.
- Todo o cálculo é feito no dispositivo. **Nunca enviar nomes de apps ou conteúdo.**

### 5.4 Modelo de dados (inicial)

```
users          (id, display_name, partner_nickname, created_at)
couples        (id, user_a_id, user_b_id, paired_at, level, window_start, window_end,
                usage_threshold_min, silence_period_min, max_missions_per_night)
pairing_codes  (code, user_id, expires_at)
presence       (user_id, public_ip_hash, continuous_usage_min, dnd, updated_at)
missions       (id, type, level, tags[], message_a, message_b, follow_up, active)
mission_runs   (id, couple_id, mission_id, sent_at, accepted_a, accepted_b,
                skipped_by, offphone_minutes_after)
```

- `message_a` / `message_b`: texto para cada papel. O backend sorteia quem fica com cada papel.
- Placeholders permitidos nas mensagens: `{parceiro}` (alcunha do outro).

### 5.5 Emparelhamento

- Um dos parceiros gera um código de 6 caracteres (válido 15 min); o outro introduz-o.
- Possível desemparelhar a qualquer momento; desemparelhar apaga o histórico do casal.

## 6. Ecrãs (mínimo possível)

- Onboarding (3 ecrãs no máximo, explicar o princípio "a app quer ser pouco usada").
- Emparelhamento.
- Permissões (uso do telemóvel, notificações).
- Definições do casal: alcunha, janela horária, nível, limite de minutos.
- Ecrã principal muito simples: botão "Estamos aborrecidos" e botão "Hoje não".

Sem feed, sem histórico visível, sem pontuação.

## 7. Roadmap

- **Fase 0 (sem código):** testar 20–30 pares de missões com 2–3 casais via WhatsApp, enviadas manualmente.
- **Fase 1 – MVP manual:** contas, emparelhamento, catálogo de missões, botão "Estamos aborrecidos", notificações sincronizadas, período de silêncio. Android + iOS (não precisa de APIs de uso).
- **Fase 2 – Trigger automático Android:** módulo nativo de uso, deteção por IP público, lógica completa do trigger, métrica de minutos sem telemóvel.
- **Fase 3 – iOS automático:** Screen Time API, se o entitlement for aprovado.
- **Fase 4 – Monetização:** pagamento único ou subscrição barata; packs temáticos (viagem, aniversário, picante, decisão de filme com catálogo de streaming). Sem publicidade.

## 8. Decisões tomadas

| Data       | Decisão                                                                                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-20 | **Autenticação:** login por código enviado por email (OTP do Supabase), sem palavra-passe.                                                                                                                                                                                                     |
| 2026-10-20 | **Botão "Estamos aborrecidos":** respeita o limite por noite, o período de silêncio e o "hoje não"/Não Incomodar de ambos. Quando não pode disparar, mostra uma mensagem genérica ("Agora não dá, tentem mais logo") sem revelar o motivo ao parceiro.                                         |
| 2026-10-20 | **Mensagem `follow_up`:** enviada como segunda notificação curta cerca de 1 minuto depois da missão.                                                                                                                                                                                           |
| 2026-10-20 | **Período de silêncio (Fase 1):** apenas suprime as notificações da própria app; não mexe no Não Incomodar do sistema.                                                                                                                                                                         |
| 2026-10-20 | **Fase 1:** a tabela `presence` fica para a Fase 2. É acrescentada uma tabela `push_tokens` para as notificações.                                                                                                                                                                              |
| 2026-10-20 | **Nível por parceiro:** `couples` guarda `level_a` e `level_b` (o nível máximo que cada um aceita); o casal recebe o menor dos dois, para que níveis provocadores só se apliquem se os dois os ativarem.                                                                                       |
| 2026-10-20 | **"Hoje não" privado:** guardado em `profiles.snoozed_until`, visível só para o próprio. O catálogo de missões e o histórico (`mission_runs`) não são legíveis pelos clientes.                                                                                                                 |
| 2026-10-20 | **Catálogo de missões:** fonte única em `supabase/missions/catalog.pt-PT.json`, validado automaticamente (≤200 caracteres, só `{parceiro}`, linguagem neutra). Duas missões de exemplo foram ajustadas por assumirem género ("deixa-o eliminar um", "fazê-lo rir").                            |
| 2026-10-20 | **"Noite" e "hoje não":** o dia da app começa às 05:00 (hora local do casal), para que uma noite que passa da meia-noite conte como uma só. O limite de missões por noite é contado neste dia e o "hoje não" dura até às 05:00 seguintes. Por isso a janela horária não pode incluir as 05:00. |
| 2026-10-20 | **Trigger manual fora da janela:** o botão "Estamos aborrecidos" funciona a qualquer hora (é um pedido explícito do casal), mas conta para o limite da noite e respeita o silêncio e o "hoje não". A janela horária só limita o trigger automático.                                            |
| 2026-10-20 | **Escolha de missões:** só missões até ao nível do casal; primeiro as que nunca foram enviadas, depois a enviada há mais tempo; sempre que possível, de um tipo diferente da anterior.                                                                                                         |
| 2026-10-20 | **Definições na Fase 1:** nomes, janela horária e nível (Leve/Romântico). O limite de minutos de uso só aparece na Fase 2, quando passar a ter efeito; o nível 3 ("picante") chega com os packs da Fase 4.                                                                                     |
| 2026-10-21 | **Fase 2 (Android):** heartbeat por tarefa em segundo plano do sistema (WorkManager, ~15 min, sem notificação permanente), só dentro da janela do casal. O trigger automático só funciona se os dois tiverem Android; os restantes casais ficam com o botão manual até à Fase 3.               |
| 2026-10-21 | **Sinais de presença:** "juntos" = mesmo hash HMAC do IP público (o IP nunca é guardado); sinais válidos durante 20 min; o uso reportado não é extrapolado. O Não Incomodar reportado também bloqueia o trigger manual.                                                                        |
| 2026-10-21 | **Minutos sem telemóvel:** desde que o telemóvel é pousado (até 10 min depois da missão) até voltar a ser usado; olhadelas < 30 s não contam; máximo 120 min; guarda-se o menor dos dois.                                                                                                      |

## 9. Decisões em aberto

- Nome final da app.
- Viabilidade do entitlement Family Controls na Apple.
- Modelo de preço (pagamento único vs subscrição).
- Período de silêncio com Não Incomodar do sistema em fases posteriores.

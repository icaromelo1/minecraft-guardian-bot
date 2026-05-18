# Minecraft Bots — SkyFactory 4

Projeto de bots para o servidor SF4 em `say-unnamed.gl.joinmc.link`.  
Cada bot roda em container Docker separado e é independente dos outros.

---

## Estrutura do projeto

```
minecraft-bots/
  docker-compose.yml   — orquestra todos os bots
  .env                 — config compartilhada (host, porta, target)
  AGENTE-BOTS.md       — este arquivo
  guardian-1/          — bot guardian (segue e protege um player)
    src/
      bot.js           — lógica principal
      forge-handshake.js — handler FML|HS customizado (não usado atualmente)
    package.json
    Dockerfile
```

---

## Como funciona o handshake Forge

SF4 exige Forge no cliente. A sequência para o bot conectar:

1. **Ping** do servidor → retorna lista de 188 mods em `modinfo.modList`
2. **`forgeHandshake(client, { forgeMods })`** → injeta a lista real no handshake FML
3. Servidor aceita o bot como cliente Forge legítimo

Sem o ping + injeção, o servidor kica com "This server has mods that require FML/Forge".

---

## Configuração (.env)

```env
MC_HOST=host.docker.internal   # localhost do Mac via Docker
MC_PORT=25565
TARGET_PLAYER=Tiltado121       # player que o guardian segue e protege
FOLLOW_RANGE=3                 # distância ideal de seguimento (blocos)
PROTECT_RANGE=12               # raio de detecção de mobs hostis
RECONNECT_MS=5000              # ms para reconectar após queda
```

---

## Subir / parar

```bash
cd /Users/icaromelo/projetos/minecraft-bots

# Subir bot guardian
docker compose up -d bot-guardian-1

# Ver logs (filtrar noise de chunks)
docker logs bot-guardian-1 -f 2>&1 | grep -v "Ignoring block"

# Parar
docker compose stop bot-guardian-1
```

---

## Requisitos do servidor SF4

| Configuração | Valor necessário | Motivo |
|---|---|---|
| `online-mode` | `false` | Bot usa conta offline (sem auth Mojang) |
| `allow-flight` | `true` | Bot flutua durante pathfinding |

---

## Bot guardian-1

**Função:** segue um player alvo e ataca mobs hostis próximos a ele.

**Comportamento:**
- Pinga o servidor para obter a lista de mods Forge
- Conecta com handshake Forge completo
- Ao spawnar: inicia loop de 500ms
  - Se o player alvo está no range de visão → segue (GoalFollow, distância `FOLLOW_RANGE`)
  - Se há mob hostil a menos de `PROTECT_RANGE` blocos do alvo → se aproxima e ataca
- Reconecta automaticamente após queda (5s)

**Limitação conhecida:** pacotes com NBT de itens customizados do SF4 ocasionalmente derrubam a conexão. O bot reconecta automaticamente — não afeta a funcionalidade principal.

**Mobs monitorados:**
zombie, skeleton, spider, creeper, enderman, witch, blaze, ghast, zombie_pigman, wither_skeleton, cave_spider, slime, magma_cube, phantom, drowned, husk, stray, vindicator, evoker, vex, silverfish, guardian, elder_guardian

---

## Próximos bots (ideias)

| Nome sugerido | Função |
|---|---|
| `bot-farmer-1` | Planta e colhe automaticamente em um perímetro |
| `bot-miner-1` | Minera em uma área definida e deposita em baú |
| `bot-trader-1` | Gerencia trocas automáticas ou crafting |
| `bot-scout-1` | Explora o mapa e reporta estruturas encontradas |

Para criar um novo bot: copiar a pasta `guardian-1/`, adaptar `src/bot.js`, e adicionar serviço no `docker-compose.yml`.

---

## Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| Kick "requires FML/Forge" | Ping não retornou mod list | Verificar se servidor está up; retry automático |
| Kick "Failed to verify username" | `online-mode=true` no servidor | Setar `online-mode=false` em server.properties |
| Kick "Flying is not enabled" | `allow-flight=false` | Setar `allow-flight=true` em server.properties |
| Bot conecta mas não segue | TARGET_PLAYER não está no range de visão | Normal — bot aguarda o player aparecer |
| Desconexão frequente (~30s) | NBT de itens mod customizados | Normal — reconexão automática em 5s |

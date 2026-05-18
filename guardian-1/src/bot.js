const mineflayer   = require('mineflayer')
const mc           = require('minecraft-protocol')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { forgeHandshake } = require('minecraft-protocol-forge')

// --- Config ---
const HOST          = process.env.MC_HOST          || 'host.docker.internal'
const PORT          = parseInt(process.env.MC_PORT  || '25565')
const USERNAME      = process.env.BOT_USERNAME      || 'GuardianBot'
const TARGET_PLAYER = process.env.TARGET_PLAYER     || ''
const FOLLOW_RANGE  = parseInt(process.env.FOLLOW_RANGE  || '3')
const PROTECT_RANGE = parseInt(process.env.PROTECT_RANGE || '12')
const RECONNECT_MS  = parseInt(process.env.RECONNECT_MS  || '5000')

const HOSTILE_MOBS = new Set([
  'zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch',
  'blaze', 'ghast', 'zombie_pigman', 'wither_skeleton', 'cave_spider',
  'slime', 'magma_cube', 'phantom', 'drowned', 'husk', 'stray',
  'vindicator', 'evoker', 'vex', 'silverfish', 'guardian', 'elder_guardian'
])

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

// ---- Passo 1: ping para obter lista de mods Forge ----

function pingAndConnect() {
  if (!TARGET_PLAYER) {
    log('ERRO: defina TARGET_PLAYER no .env')
    process.exit(1)
  }

  log(`Pingando ${HOST}:${PORT} para obter mod list...`)

  mc.ping({ host: HOST, port: PORT, version: '1.12.2' }, (err, response) => {
    let forgeMods = []

    if (err) {
      log(`Ping falhou: ${err.message} — conectando sem mod list`)
    } else if (response.modinfo && response.modinfo.type === 'FML') {
      forgeMods = response.modinfo.modList || []
      log(`Mod list obtida via ping: ${forgeMods.length} mods`)
    } else {
      log('Servidor não é Forge ou não retornou mod list — conectando sem')
    }

    createBot(forgeMods)
  })
}

// ---- Passo 2: criar bot com mod list correta ----

function createBot(forgeMods) {
  log(`Conectando em ${HOST}:${PORT} como ${USERNAME}...`)

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: '1.12.2',
    auth: 'offline',
    hideErrors: true
  })

  // Injeta o handshake Forge com a lista real de mods do servidor
  if (forgeMods.length > 0) {
    forgeHandshake(bot._client, { forgeMods })
    log(`Forge handshake configurado com ${forgeMods.length} mods`)
  }

  // Suprime erros de parse de NBT de itens de mods customizados (SF4 específico)
  // Sem isso, qualquer item com NBT desconhecido derruba a conexão
  bot._client.on('error', (err) => {
    if (err?.field === 'play.toClient') return
    log(`Erro cliente: ${err.message}`)
  })

  bot.loadPlugin(pathfinder)

  // ---- Eventos ----

  bot.once('spawn', () => {
    log(`Spawnado! Seguindo e protegendo: ${TARGET_PLAYER}`)

    const mcData = require('minecraft-data')(bot.version)
    const movements = new Movements(bot, mcData)
    movements.allowSprinting = true
    movements.canDig = false
    bot.pathfinder.setMovements(movements)

    setInterval(() => tick(bot), 500)
  })

  bot.on('health', () => {
    if (bot.health <= 4) log(`⚠️  HP baixo: ${bot.health}/20`)
  })

  bot.on('kicked', (reason) => {
    try { log(`Kickado: ${JSON.parse(reason).text}`) }
    catch { log(`Kickado: ${reason}`) }
  })

  bot.on('end', (reason) => {
    log(`Desconectado (${reason}). Reconectando em ${RECONNECT_MS / 1000}s...`)
    setTimeout(pingAndConnect, RECONNECT_MS)
  })

  bot.on('error', (err) => {
    // Erros de desserialização NBT de mods customizados são esperados — ignorar
    if (err.message?.includes('Deserialization error') || err.message?.includes('unexpected tag')) return
    log(`Erro: ${err.message}`)
  })
}

// ---- Loop principal (500ms) ----

function tick(bot) {
  const target = bot.players[TARGET_PLAYER]
  if (!target?.entity) return

  follow(bot, target.entity)
  protect(bot, target.entity)
}

function follow(bot, targetEntity) {
  bot.pathfinder.setGoal(
    new goals.GoalFollow(targetEntity, FOLLOW_RANGE),
    true
  )
}

function protect(bot, targetEntity) {
  const threat = findClosestThreat(bot, targetEntity.position)
  if (!threat) return

  const distToThreat = bot.entity.position.distanceTo(threat.position)
  if (distToThreat <= 3) {
    bot.attack(threat)
  } else {
    bot.pathfinder.setGoal(new goals.GoalNear(
      threat.position.x, threat.position.y, threat.position.z, 2
    ))
  }
}

function findClosestThreat(bot, targetPos) {
  let closest = null, closestDist = Infinity

  for (const entity of Object.values(bot.entities)) {
    if (!HOSTILE_MOBS.has(entity.name)) continue
    const dist = entity.position.distanceTo(targetPos)
    if (dist < PROTECT_RANGE && dist < closestDist) {
      closest = entity
      closestDist = dist
    }
  }

  return closest
}

// Evita crash por erros de parse de NBT de mods customizados (SF4 mod items)
process.on('uncaughtException', (err) => {
  if (err?.field === 'play.toClient') return
  console.error('[FATAL]', err)
  process.exit(1)
})

pingAndConnect()

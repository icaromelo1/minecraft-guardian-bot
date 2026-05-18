// Handshake FML1 (Forge 1.12.2)
// Estratégia: espelhar a lista de mods do servidor de volta para ele
// Assim o servidor pensa que o bot tem todos os mods instalados

const CHANNEL = 'FML|HS'

// Discriminadores do protocolo FML1
const D = {
  SERVER_HELLO: 0,
  CLIENT_HELLO: 1,
  MOD_LIST:     2,
  REGISTRY_ACK: 255
}

const FML_PROTOCOL_VERSION = 2

function readVarInt(buf, offset) {
  let result = 0, shift = 0, byte_
  do {
    byte_ = buf[offset++]
    result |= (byte_ & 0x7F) << shift
    shift += 7
  } while (byte_ & 0x80)
  return { value: result, offset }
}

function writeVarInt(value) {
  const bytes = []
  do {
    let byte_ = value & 0x7F
    value >>>= 7
    if (value !== 0) byte_ |= 0x80
    bytes.push(byte_)
  } while (value !== 0)
  return Buffer.from(bytes)
}

function readString(buf, offset) {
  const { value: len, offset: o } = readVarInt(buf, offset)
  const str = buf.slice(o, o + len).toString('utf8')
  return { value: str, offset: o + len }
}

function writeString(str) {
  const strBuf = Buffer.from(str, 'utf8')
  return Buffer.concat([writeVarInt(strBuf.length), strBuf])
}

function parseModList(data) {
  let offset = 1 // pula discriminador
  const { value: count, offset: o } = readVarInt(data, offset)
  offset = o
  const mods = []
  for (let i = 0; i < count; i++) {
    const { value: name, offset: o1 } = readString(data, offset)
    const { value: version, offset: o2 } = readString(data, o1)
    mods.push({ name, version })
    offset = o2
  }
  return mods
}

function buildClientHello() {
  return Buffer.from([D.CLIENT_HELLO, FML_PROTOCOL_VERSION])
}

function buildModList(mods) {
  const parts = [Buffer.from([D.MOD_LIST]), writeVarInt(mods.length)]
  for (const { name, version } of mods) {
    parts.push(writeString(name))
    parts.push(writeString(version))
  }
  return Buffer.concat(parts)
}

function buildHandshakeAck(phase) {
  return Buffer.from([D.REGISTRY_ACK, phase])
}

function inject(client) {
  let serverMods = null
  let phase = 0

  client.on('custom_payload', (packet) => {
    if (packet.channel !== CHANNEL) return
    const data = packet.data

    const discriminator = data[0]

    if (discriminator === D.SERVER_HELLO) {
      console.log('[Forge] ServerHello recebido → enviando ClientHello')
      client.write('custom_payload', {
        channel: CHANNEL,
        data: buildClientHello()
      })
    }

    else if (discriminator === D.MOD_LIST) {
      serverMods = parseModList(data)
      console.log(`[Forge] ModList do servidor: ${serverMods.length} mods → espelhando`)
      client.write('custom_payload', {
        channel: CHANNEL,
        data: buildModList(serverMods)
      })
    }

    else if (discriminator === 3) {
      // RegistryData — servidor manda dados de registry, client faz ack
      console.log(`[Forge] RegistryData recebido → ACK fase ${phase}`)
      client.write('custom_payload', {
        channel: CHANNEL,
        data: buildHandshakeAck(phase)
      })
      phase++
    }

    else if (discriminator === D.REGISTRY_ACK) {
      console.log('[Forge] Handshake completo!')
    }
  })
}

module.exports = { inject }

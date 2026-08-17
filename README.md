# Minecraft Guardian Bot

Bot que entra num servidor de Minecraft como jogador e fica de guarda, feito com mineflayer.

## A parte difícil

Servidor com modpack não aceita um cliente comum: o NeoForge faz um handshake próprio
antes de liberar a entrada. O bot implementa esse handshake à mão para conseguir se
conectar como um jogador de verdade — é aí que está o trabalho.

## Stack

Node.js · JavaScript · mineflayer · Docker

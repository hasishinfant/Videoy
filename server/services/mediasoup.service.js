const mediasoup = require('mediasoup');
const mediasoupConfig = require('../config/mediasoup.config');
const logger = require('../utils/logger');

const workers = [];
let workerIndex = 0;

// Per-session: sessionToken → { router, peers: Map<socketId, PeerState> }
// PeerState: { sendTransport, recvTransport, producers: Map, consumers: Map }
const rooms = new Map();

async function initMediasoup() {
  const numWorkers = Math.min(2, Math.max(1, require('os').cpus().length - 1));
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(mediasoupConfig.worker);
    worker.on('died', (err) => {
      logger.error(`Mediasoup worker ${worker.pid} died:`, err);
      process.exit(1);
    });
    workers.push(worker);
    logger.info(`Mediasoup worker ${worker.pid} created`);
  }
}

function getNextWorker() {
  const worker = workers[workerIndex % workers.length];
  workerIndex++;
  return worker;
}

async function createRoom(sessionToken) {
  if (rooms.has(sessionToken)) return rooms.get(sessionToken);
  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs: mediasoupConfig.router.mediaCodecs });
  const room = { router, peers: new Map() };
  rooms.set(sessionToken, room);
  logger.info(`Room created: ${sessionToken}`);
  return room;
}

function getRoom(sessionToken) {
  return rooms.get(sessionToken);
}

function getRouterRtpCapabilities(sessionToken) {
  const room = rooms.get(sessionToken);
  if (!room) throw new Error('Room not found');
  return room.router.rtpCapabilities;
}

function getOrCreatePeer(room, socketId) {
  if (!room.peers.has(socketId)) {
    room.peers.set(socketId, {
      sendTransport: null,
      recvTransport: null,
      producers: new Map(),
      consumers: new Map(),
    });
  }
  return room.peers.get(socketId);
}

async function createWebRtcTransport(sessionToken, socketId, direction) {
  const room = rooms.get(sessionToken);
  if (!room) throw new Error('Room not found');

  const transport = await room.router.createWebRtcTransport(mediasoupConfig.webRtcTransport);

  transport.on('dtlsstatechange', (state) => {
    if (state === 'closed') transport.close();
  });
  transport.on('close', () => {
    logger.debug(`Transport closed: ${transport.id}`);
  });

  // Store transport on the peer keyed by direction
  const peer = getOrCreatePeer(room, socketId);
  if (direction === 'send') {
    peer.sendTransport = transport;
  } else {
    peer.recvTransport = transport;
  }

  logger.debug(`Transport created [${direction}]: ${transport.id} for socket ${socketId}`);

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

async function connectTransport(sessionToken, socketId, transportId, dtlsParameters) {
  const room = rooms.get(sessionToken);
  if (!room) throw new Error('Room not found');

  const peer = room.peers.get(socketId);
  if (!peer) throw new Error(`Peer not found for socket ${socketId}`);

  // Find transport by ID — check both send and recv
  let transport = null;
  if (peer.sendTransport && peer.sendTransport.id === transportId) {
    transport = peer.sendTransport;
  } else if (peer.recvTransport && peer.recvTransport.id === transportId) {
    transport = peer.recvTransport;
  }

  if (!transport) {
    throw new Error(`Transport ${transportId} not found for socket ${socketId}. Send: ${peer.sendTransport?.id}, Recv: ${peer.recvTransport?.id}`);
  }

  await transport.connect({ dtlsParameters });
  logger.debug(`Transport connected: ${transportId}`);
}

async function produce(sessionToken, socketId, { transportId, kind, rtpParameters, appData }) {
  const room = rooms.get(sessionToken);
  if (!room) throw new Error('Room not found');

  const peer = room.peers.get(socketId);
  if (!peer) throw new Error(`Peer not found for socket ${socketId}`);

  if (!peer.sendTransport) {
    throw new Error(`No send transport for socket ${socketId} — createTransport({direction:"send"}) must be called first`);
  }
  if (peer.sendTransport.id !== transportId) {
    throw new Error(`Transport ID mismatch. Expected ${peer.sendTransport.id}, got ${transportId}`);
  }

  const producer = await peer.sendTransport.produce({ kind, rtpParameters, appData: appData || {} });
  peer.producers.set(producer.id, producer);

  producer.on('transportclose', () => {
    peer.producers.delete(producer.id);
  });

  logger.debug(`Producer created: ${producer.id} (${kind}) for socket ${socketId}`);
  return producer.id;
}

async function consume(sessionToken, socketId, { producerId, rtpCapabilities }) {
  const room = rooms.get(sessionToken);
  if (!room) throw new Error('Room not found');

  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Cannot consume — incompatible RTP capabilities');
  }

  const peer = room.peers.get(socketId);
  if (!peer || !peer.recvTransport) {
    throw new Error(`No recv transport for socket ${socketId}`);
  }

  const consumer = await peer.recvTransport.consume({
    producerId,
    rtpCapabilities,
    paused: true,
  });

  peer.consumers.set(consumer.id, consumer);

  consumer.on('transportclose', () => peer.consumers.delete(consumer.id));
  consumer.on('producerclose', () => peer.consumers.delete(consumer.id));

  return {
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

async function resumeConsumer(sessionToken, socketId, consumerId) {
  const room = rooms.get(sessionToken);
  const peer = room?.peers.get(socketId);
  const consumer = peer?.consumers.get(consumerId);
  if (consumer && !consumer.closed) await consumer.resume();
}

async function pauseProducer(sessionToken, socketId, producerId) {
  const room = rooms.get(sessionToken);
  const peer = room?.peers.get(socketId);
  const producer = peer?.producers.get(producerId);
  if (producer && !producer.closed) await producer.pause();
}

async function resumeProducer(sessionToken, socketId, producerId) {
  const room = rooms.get(sessionToken);
  const peer = room?.peers.get(socketId);
  const producer = peer?.producers.get(producerId);
  if (producer && !producer.closed) await producer.resume();
}

function getProducersInRoom(sessionToken, excludeSocketId) {
  const room = rooms.get(sessionToken);
  if (!room) return [];
  const result = [];
  for (const [socketId, peer] of room.peers.entries()) {
    if (socketId === excludeSocketId) continue;
    for (const [producerId, producer] of peer.producers.entries()) {
      if (!producer.closed) {
        result.push({ producerId, socketId, kind: producer.kind });
      }
    }
  }
  return result;
}

function removePeer(sessionToken, socketId) {
  const room = rooms.get(sessionToken);
  if (!room) return;
  const peer = room.peers.get(socketId);
  if (!peer) return;

  peer.producers.forEach((p) => { try { p.close(); } catch {} });
  peer.consumers.forEach((c) => { try { c.close(); } catch {} });
  try { peer.sendTransport?.close(); } catch {}
  try { peer.recvTransport?.close(); } catch {}
  room.peers.delete(socketId);
  logger.info(`Peer removed from room ${sessionToken}: ${socketId}`);
}

function closeRoom(sessionToken) {
  const room = rooms.get(sessionToken);
  if (!room) return;
  for (const socketId of [...room.peers.keys()]) {
    removePeer(sessionToken, socketId);
  }
  try { room.router.close(); } catch {}
  rooms.delete(sessionToken);
  logger.info(`Room closed: ${sessionToken}`);
}

module.exports = {
  initMediasoup,
  createRoom,
  getRoom,
  getRouterRtpCapabilities,
  createWebRtcTransport,
  connectTransport,
  produce,
  consume,
  resumeConsumer,
  pauseProducer,
  resumeProducer,
  getProducersInRoom,
  removePeer,
  closeRoom,
};

// tests/k6/lib/socketio.js
//
// Engine.IO / Socket.IO framing for k6/ws. Handles the binary protocol so
// journey files deal only with business events.
//
// Engine.IO packet types (first char of each WebSocket frame):
//   0 = open      (server → client, JSON payload with sid, pingInterval, pingTimeout)
//   2 = ping      (client → server, or server → client in v3)
//   3 = pong      (server → client, or client → server in v3)
//   4 = message   (bidirectional — carries the Socket.IO packet as its payload)
//
// Socket.IO packet types (first char after the Engine.IO '4' prefix):
//   0 = CONNECT        (namespace handshake)
//   2 = EVENT           (["eventName", ...args])
//   4 = CONNECT_ERROR   (server rejected the connection)

export const ENGINE = { OPEN: '0', PING: '2', PONG: '3', MESSAGE: '4' };
export const SIO = { CONNECT: '0', DISCONNECT: '1', EVENT: '2', ACK: '3', CONNECT_ERROR: '4' };

/**
 * Parse a raw WebSocket frame into a structured packet.
 * Returns { engineType, sioType?, namespace?, data? }.
 */
export function parsePacket(raw) {
  if (!raw || raw.length === 0) return null;

  const engineType = raw[0];
  const result = { engineType, raw };

  if (engineType === ENGINE.OPEN) {
    try { result.data = JSON.parse(raw.slice(1)); } catch { /* ignore */ }
    return result;
  }

  if (engineType === ENGINE.PING || engineType === ENGINE.PONG) {
    return result;
  }

  if (engineType === ENGINE.MESSAGE) {
    const sioType = raw[1];
    result.sioType = sioType;

    // Namespace — everything between sioType and the first comma or '['
    let rest = raw.slice(2);
    let namespace = '/';
    if (rest.length > 0 && rest[0] !== '[' && rest[0] !== '{') {
      const commaIdx = rest.indexOf(',');
      if (commaIdx !== -1) {
        namespace = rest.slice(0, commaIdx);
        rest = rest.slice(commaIdx + 1);
      } else {
        namespace = rest;
        rest = '';
      }
    }
    result.namespace = namespace;

    if (sioType === SIO.EVENT && rest.length > 0) {
      try { result.data = JSON.parse(rest); } catch { /* ignore */ }
    } else if (sioType === SIO.CONNECT && rest.length > 0) {
      try { result.data = JSON.parse(rest); } catch { /* ignore */ }
    } else if (sioType === SIO.CONNECT_ERROR && rest.length > 0) {
      try { result.data = JSON.parse(rest); } catch { /* ignore */ }
    }

    return result;
  }

  return result;
}

/**
 * Check whether a parsed packet is a Socket.IO event with the given name.
 */
export function isEvent(packet, eventName) {
  return (
    packet &&
    packet.engineType === ENGINE.MESSAGE &&
    packet.sioType === SIO.EVENT &&
    Array.isArray(packet.data) &&
    packet.data[0] === eventName
  );
}

/**
 * Get the payload of a Socket.IO event (the second element of the data array).
 */
export function eventPayload(packet) {
  if (packet && Array.isArray(packet.data) && packet.data.length > 1) {
    return packet.data[1];
  }
  return null;
}

/**
 * Build a Socket.IO event frame to send over the WebSocket.
 * Format: 4 (engine message) + 2 (sio event) + JSON(["eventName", payload])
 */
export function encodeEvent(eventName, payload) {
  const args = payload !== undefined ? [eventName, payload] : [eventName];
  return `${ENGINE.MESSAGE}${SIO.EVENT}${JSON.stringify(args)}`;
}

/**
 * Build the Socket.IO CONNECT packet for the default namespace.
 * Format: 40 (engine message + sio connect) + optional JSON auth
 */
export function encodeConnect(auth) {
  if (auth) {
    return `${ENGINE.MESSAGE}${SIO.CONNECT}${JSON.stringify(auth)}`;
  }
  return `${ENGINE.MESSAGE}${SIO.CONNECT}`;
}

/**
 * Build an Engine.IO pong response.
 */
export function encodePong() {
  return ENGINE.PONG;
}

/**
 * Build the Socket.IO WebSocket URL from a base WS URL.
 * Engine.IO expects /socket.io/?EIO=4&transport=websocket
 */
export function buildWsUrl(wsBaseUrl) {
  return `${wsBaseUrl}/socket.io/?EIO=4&transport=websocket`;
}

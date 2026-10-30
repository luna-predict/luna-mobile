/**
 * Pears Worklet Bundle Source for Bare Runtime
 *
 * This JavaScript module runs inside a Bare Worklet (`react-native-bare-kit`).
 * It handles Holepunch P2P primitives (Hyperswarm DHT, Corestore / Hypercore,
 * Noise protocol peer-to-peer encryption, and snapshot replication).
 *
 * It communicates with the React Native UI thread via BareKit.IPC with framed JSON commands.
 */

export const PEARS_WORKLET_SOURCE = `
const { IPC } = BareKit;
let Hyperswarm, Corestore, b4a;

try {
  Hyperswarm = require('hyperswarm');
  Corestore = require('corestore');
  b4a = require('b4a');
} catch (e) {
  // Graceful fallback if native modules aren't linked in current target
}

let swarm = null;
let store = null;
let core = null;
let activeTopic = null;

function sendToRN(type, payload) {
  try {
    const msg = JSON.stringify({ type, payload });
    IPC.write(Buffer.from(msg + '\\n'));
  } catch (err) {
    // ignore
  }
}

if (!Hyperswarm || !Corestore) {
  sendToRN('status', { ready: false, reason: 'Pears native dependencies not resolved in Bare' });
} else {
  store = new Corestore('./lunapredict-pears');
  sendToRN('status', { ready: true });
}

let buffer = '';
IPC.on('data', async (chunk) => {
  buffer += chunk.toString();
  let boundary = buffer.indexOf('\\n');
  while (boundary !== -1) {
    const line = buffer.slice(0, boundary).trim();
    buffer = buffer.slice(boundary + 1);
    boundary = buffer.indexOf('\\n');
    if (!line) continue;

    try {
      const { id, command, params } = JSON.parse(line);
      handleCommand(id, command, params);
    } catch (e) {
      sendToRN('error', { error: e.message });
    }
  }
});

async function handleCommand(id, command, params) {
  try {
    switch (command) {
      case 'ping': {
        sendToRN('response', { id, result: { ok: true, runtime: 'bare-worklet' } });
        break;
      }

      case 'createInvite': {
        if (!Hyperswarm || !store) throw new Error('Holepunch modules not ready');
        const { topicHex, sharerName } = params;
        const topic = b4a.from(topicHex, 'hex');

        if (swarm) await swarm.destroy();
        swarm = new Hyperswarm();
        activeTopic = topic;

        core = store.get({ name: 'shared-snapshot' });
        await core.ready();

        swarm.on('connection', (conn, info) => {
          core.replicate(conn);
          sendToRN('event', {
            event: 'partnerConnected',
            data: {
              publicKey: b4a.toString(conn.remotePublicKey, 'hex'),
              client: info.client,
            }
          });
        });

        const discovery = swarm.join(topic, { server: true, client: false });
        await discovery.flushed();

        sendToRN('response', {
          id,
          result: {
            success: true,
            coreKey: b4a.toString(core.key, 'hex'),
            discoveryKey: b4a.toString(core.discoveryKey, 'hex')
          }
        });
        break;
      }

      case 'joinWithCode': {
        if (!Hyperswarm || !store) throw new Error('Holepunch modules not ready');
        const { topicHex, partnerName } = params;
        const topic = b4a.from(topicHex, 'hex');

        if (swarm) await swarm.destroy();
        swarm = new Hyperswarm();
        activeTopic = topic;

        core = store.get({ name: 'remote-snapshot' });
        await core.ready();

        swarm.on('connection', (conn) => {
          core.replicate(conn);
          sendToRN('event', {
            event: 'connectionEstablished',
            data: { peer: b4a.toString(conn.remotePublicKey, 'hex') }
          });
        });

        const discovery = swarm.join(topic, { server: false, client: true });
        await discovery.flushed();

        sendToRN('response', {
          id,
          result: { success: true }
        });
        break;
      }

      case 'publishSnapshot': {
        if (!core) throw new Error('Hypercore is not initialized');
        const { snapshot } = params;
        const data = Buffer.from(JSON.stringify(snapshot));
        await core.append(data);

        sendToRN('response', {
          id,
          result: { length: core.length, appended: true }
        });
        break;
      }

      case 'fetchLatestSnapshot': {
        if (!core) {
          sendToRN('response', { id, result: { snapshot: null } });
          return;
        }
        await core.update();
        if (core.length === 0) {
          sendToRN('response', { id, result: { snapshot: null } });
          return;
        }
        const block = await core.get(core.length - 1);
        const snapshot = JSON.parse(block.toString());
        sendToRN('response', { id, result: { snapshot } });
        break;
      }

      case 'unlink': {
        if (swarm) {
          await swarm.destroy();
          swarm = null;
        }
        if (core) {
          await core.close();
          core = null;
        }
        activeTopic = null;
        sendToRN('response', { id, result: { unlinked: true } });
        break;
      }

      default:
        throw new Error('Unknown command: ' + command);
    }
  } catch (err) {
    sendToRN('response', { id, error: err.message });
  }
}
`;


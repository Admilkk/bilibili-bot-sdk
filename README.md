# bilibili-bot-sdk

Standalone TypeScript SDK for the Bilibili private IM (direct message) bot API.

Extracted from [hack-plugin](../README.md). Not published to npm — import directly.

## Structure

```
bilibili-bot-sdk/
├── src/
│   ├── index.ts       # Public re-exports
│   ├── types.ts       # All shared interfaces & types
│   ├── crypto.ts      # MD5/HMAC signing, EID, trace-id generation
│   ├── http.ts        # Signed Axios wrapper (fetchRequest)
│   ├── grpc.ts        # gRPC client: getSessions, getUserMessages, sendMsg, markRead
│   ├── auth.ts        # TV QR login, Web QR login, token refresh
│   ├── media.ts       # Image upload to Bilibili BFS
│   ├── polling.ts     # MessagePoller (EventEmitter-based polling loop)
│   ├── client.ts      # BiliBot (high-level single-account client)
│   └── manager.ts     # BiliBotManager (multi-account pool)
├── package.json
└── tsconfig.json
```

## Quick Start

```ts
import { BiliBot } from './src/index.js';
import type { BiliCredentials } from './src/index.js';

const creds: BiliCredentials = {
  DedeUserID: '123456789',
  access_token: 'your_access_token',
  refresh_token: 'your_refresh_token',
  csrf: 'your_bili_jct',
  SESSDATA: 'your_sessdata',
};

const bot = new BiliBot(creds, { pollInterval: 3000 });

bot.onMessage(async (msg) => {
  if (msg.type === 'text') {
    console.log(`[${msg.senderId}]: ${msg.text}`);
    await bot.sendText(msg.senderId, 'pong');
  }
});

bot.start();
```

## Multi-account

```ts
import { BiliBotManager } from './src/index.js';

const manager = new BiliBotManager({ concurrency: 5 });

manager.onMessage(async (msg) => {
  console.log(`Bot recv [${msg.senderId}]: ${msg.rawText}`);
});

// Load from ./data/*.json credential files
await manager.startFromDir('./data');
```

## Login (QR Code)

```ts
import { BiliAuth } from './src/index.js';

const auth = new BiliAuth();

// TV mode (most reliable for bots)
const { data } = await auth.getTvQrCode();
console.log('Scan this URL:', data.url);

const creds = await auth.pollTvQrLogin(data.auth_code);
console.log('Logged in as UID:', creds.DedeUserID);
```

## Token Refresh

```ts
import { BiliAuth } from './src/index.js';

const auth = new BiliAuth();
const newCreds = await auth.refreshToken(existingCreds);
```

## Credential File Format

Credential files are JSON objects keyed by UID:

```json
{
  "123456789": {
    "DedeUserID": "123456789",
    "access_token": "...",
    "refresh_token": "...",
    "csrf": "...",
    "SESSDATA": "..."
  }
}
```

## Build

```bash
cd bilibili-bot-sdk
npm install
npm run build
```

## Key APIs

### `BiliBot`

| Method | Description |
|---|---|
| `start()` | Begin polling for messages |
| `stop()` | Stop polling |
| `onMessage(fn)` | Register a message handler |
| `sendText(uid, text)` | Send a text message |
| `sendImage(uid, buffer)` | Upload and send an image |
| `recallMessage(uid, msgKey)` | Recall a sent message |

### `BiliAuth`

| Method | Description |
|---|---|
| `getTvQrCode()` | Get TV-mode QR auth code |
| `pollTvQrLogin(authCode)` | Poll until TV QR is scanned |
| `getWebQrCode()` | Get web-mode QR key |
| `pollWebQrLogin(qrcodeKey)` | Poll until web QR is scanned |
| `refreshToken(creds)` | Refresh access/refresh tokens |

### `BiliBotManager`

| Method | Description |
|---|---|
| `startFromDir(dir)` | Load credentials from a directory |
| `addBot(creds)` | Add a single bot |
| `getBot(uid)` | Retrieve bot by UID |
| `onMessage(fn)` | Register handler for all bots |
| `stopAll()` | Stop all bots |

## gRPC Methods (low-level)

Import from `bilibili-bot-sdk/grpc` (or `Grpc` namespace):

- `getSessions(creds)` — fetch session list
- `getUserMessages(creds, talkerId)` — fetch messages from a session
- `sendMsg(creds, content, talkerId)` — send a message
- `markMessagesAsRead(creds, talkerId, seqno)` — mark session as read
- `recallMsg(creds, uid)` — recall a message
- `getDanmakuSegMobile(params)` — fetch video danmaku

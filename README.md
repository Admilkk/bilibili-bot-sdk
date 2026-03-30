# bilibili-bot-sdk

基于 TypeScript 的 B站私信机器人 SDK，支持 gRPC 私信收发、直播弹幕、视频互动等功能。

## 目录结构

```
bilibili-bot-sdk/
├── src/
│   ├── index.ts       # 公共导出入口
│   ├── types.ts       # 所有类型定义
│   ├── crypto.ts      # MD5/HMAC 签名、EID、trace-id 生成
│   ├── http.ts        # 带签名的 Axios 请求封装
│   ├── grpc.ts        # gRPC 客户端：会话、消息收发、已读上报、撤回
│   ├── auth.ts        # TV 二维码登录、Web 二维码登录、Token 刷新
│   ├── media.ts       # 图片上传至 B站 BFS
│   ├── live.ts        # 直播间弹幕、直播间信息、点赞、分享
│   ├── api.ts         # 通用 REST API：点赞、投币、三连、关注、签到等
│   ├── polling.ts     # MessagePoller（EventEmitter 轮询循环）
│   ├── client.ts      # BiliBot（单账号高层客户端）
│   └── manager.ts     # BiliBotManager（多账号管理池）
├── package.json
└── tsconfig.json
```

## 快速开始

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

## 多账号

```ts
import { BiliBotManager } from './src/index.js';

const manager = new BiliBotManager({ concurrency: 5 });

manager.onMessage(async (msg) => {
  console.log(`Bot recv [${msg.senderId}]: ${msg.rawText}`);
});

// 从 ./data/*.json 凭据文件加载所有账号
await manager.startFromDir('./data');
```

## 登录（二维码）

```ts
import { BiliAuth } from './src/index.js';

const auth = new BiliAuth();

// TV 模式（机器人账号推荐）
const { data } = await auth.getTvQrCode();
console.log('扫码链接:', data.url);

const creds = await auth.pollTvQrLogin(data.auth_code);
console.log('登录成功，UID:', creds.DedeUserID);
```

## Token 刷新

```ts
import { refreshToken } from './src/index.js';

const newCreds = await refreshToken(creds.access_token, creds.refresh_token);
```

## 凭据格式

```ts
interface BiliCredentials {
  DedeUserID: string;      // 用户 UID
  access_token: string;    // App 端 access token
  refresh_token: string;   // 用于刷新 access_token
  csrf: string;            // bili_jct，Web 端 CSRF token
  SESSDATA: string;        // Web 端 Session cookie
}
```

## BiliBot API

| 方法 | 说明 |
|---|---|
| `start()` | 启动消息轮询 |
| `stop()` | 停止轮询 |
| `onMessage(fn)` | 注册消息处理回调 |
| `sendText(uid, text)` | 发送文字私信 |
| `sendImage(uid, buffer)` | 上传图片并发送 |
| `recallMessage(uid, msgKey)` | 撤回已发送消息 |
| `markRead(talkerId, ackSeqno)` | 标记会话已读 |
| `refreshToken()` | 刷新 access_token |

## BiliAuth API

| 方法 | 说明 |
|---|---|
| `getTvQrCode()` | 获取 TV 模式二维码授权码 |
| `pollTvQrLogin(authCode)` | 轮询 TV 二维码扫描状态 |
| `getWebQrCode()` | 获取 Web 模式二维码 |
| `pollWebQrLogin(qrcodeKey)` | 轮询 Web 二维码扫描状态 |
| `refreshToken(creds)` | 刷新 access/refresh token |

## BiliBotManager API

| 方法 | 说明 |
|---|---|
| `startFromDir(dir)` | 从目录加载凭据并启动所有 bot |
| `addBot(creds)` | 添加单个 bot |
| `getBot(uid)` | 按 UID 获取 bot 实例 |
| `onMessage(fn)` | 注册全局消息回调 |
| `stopAll()` | 停止所有 bot |

## gRPC 模块（低层）

```ts
import * as Grpc from './src/grpc.js';
```

| 函数 | 说明 |
|---|---|
| `getSessions(creds)` | 获取私信会话列表 |
| `getUserMessages(creds, talkerId)` | 拉取指定会话消息 |
| `sendMsg(creds, receiverId, payload)` | 发送私信（文本/图片） |
| `markMessagesAsRead(creds, talkerId, opts)` | 上报已读 |
| `recallMsg(creds, talkerId, msgKey)` | 撤回消息 |
| `getDynamicFollowList(creds)` | 获取关注动态列表 |

## 直播模块

```ts
import * as Live from './src/live.js';
```

| 函数 | 说明 |
|---|---|
| `sendDanmu(creds, roomId, msg)` | 发送直播弹幕 |
| `getRoomInfo(creds, roomId)` | 获取直播间信息 |
| `likeRoom(creds, roomId)` | 点赞直播间 |
| `getDanmuHistory(creds, roomId)` | 获取历史弹幕 |
| `getUserLiveInfo(uid, creds?)` | 查询用户直播间信息 |
| `liveShare(creds, roomId)` | 触发直播间分享互动 |

## 通用 API 模块

```ts
import * as Api from './src/api.js';
```

| 函数 | 说明 |
|---|---|
| `getMyInfo(creds)` | 获取当前账号信息（Web） |
| `getMyInfo2(creds)` | 获取当前账号信息（App） |
| `getSpace(creds, uid)` | 获取用户空间信息 |
| `likeVideo(creds, aid, like)` | 点赞/取消点赞视频 |
| `dislikeVideo(creds, aid)` | 点踩视频 |
| `addCoin(creds, aid, coin?)` | 给视频投币 |
| `tripleVideo(creds, aid)` | 一键三连 |
| `shareVideo(creds, aid)` | 分享视频（上报） |
| `reportWatch(creds, aid, cid, time?)` | 上报视频观看进度 |
| `replyVideo(creds, aid, msg)` | 评论视频 |
| `favVideo(creds, aid)` | 收藏视频 |
| `unfavVideo(creds, aid)` | 取消收藏视频 |
| `modifyRelation(creds, uid, act)` | 关注/取关用户 |
| `signManga(creds)` | 漫画每日签到 |
| `addVipExperience(creds)` | 领取大会员观看经验 |
| `receiveVipPrivilege(creds, type?)` | 领取大会员权益 |
| `getExpReward(creds)` | 查询每日经验奖励状态 |
| `getFeed(creds)` | 获取推荐视频流 |
| `getLiveFeed(creds)` | 获取直播推荐流 |

## 视频模块

```ts
import * as Video from './src/video.js';
```

| 函数 | 说明 |
|---|---|
| `getVideoInfo(bvidOrAid, creds?)` | 获取视频基本信息（标题、封面、cid 等） |
| `getPlayUrl(creds, aid, cid, opts?)` | 获取视频流地址（DASH/FLV，支持 1080P） |
| `getVideoDetail(creds, aid)` | 获取视频详情（App 端，含分 P 列表） |
| `searchVideo(creds, keyword, opts?)` | 搜索视频 |

**getPlayUrl 画质参数（qn）：**

| qn | 画质 |
|---|---|
| 127 | 8K |
| 120 | 4K |
| 116 | 1080P60 |
| 80 | 1080P |
| 64 | 720P |
| 32 | 480P |
| 16 | 360P |

/**
 * @packageDocumentation
 * Bilibili Bot SDK 公共 API 入口。
 *
 * @example
 * ```ts
 * import { BiliBot, BiliBotManager, BiliAuth } from 'bilibili-bot-sdk';
 * ```
 */

// 主客户端
export { BiliBot } from './client.js';

// 多账号管理器
export { BiliBotManager } from './manager.js';
export type { BiliBotManagerOptions, CredentialFile } from './manager.js';
export { loadCredentialFile, loadCredentialDir } from './manager.js';

// 认证
export { BiliAuth } from './auth.js';
export { getTvQrCode, pollTvQrCode, getWebQrCode, pollWebQrCode, refreshToken, parseCookieString } from './auth.js';

// gRPC 层（高级用法）
export * as Grpc from './grpc.js';

// REST API
export * as Api from './api.js';

// 直播间 API
export * as Live from './live.js';

// 媒体上传
export { uploadImage } from './media.js';

// 全部类型
export type {
  BiliCredentials,
  QrLoginResult,
  BiliApiResponse,
  BaseMessage,
  TextMessage,
  ImageMessage,
  ShareMessage,
  IncomingMessage,
  MessageHandler,
  SendMessageOptions,
  BiliBotOptions,
  ImageUploadResult,
  RawGrpcSession,
  RawGrpcMsg,
} from './types.js';

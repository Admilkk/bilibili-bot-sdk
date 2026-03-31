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
export { BiliBot, BotLiveFacade, BotVideoFacade, BotApiFacade, BotUserFacade, BotDynamicFacade, BotCommentFacade, BotFavFacade, BotHistoryFacade, BotSearchFacade } from './client.js';

// 多账号管理器
export { BiliBotManager } from './manager.js';
export type { BiliBotManagerOptions, CredentialFile } from './manager.js';
export { loadCredentialFile, loadCredentialDir } from './manager.js';

// 认证
export { reportWatch, replyVideo, unfavVideo, favVideo, dislikeVideo, getFeed, getLiveFeed } from './api.js';
export { BiliAuth } from './auth.js';
export { getTvQrCode, pollTvQrLogin, getWebQrCode, pollWebQrLogin, refreshToken, parseCookieString } from './auth.js';

// gRPC 层（高级用法）
export * as Grpc from './grpc.js';

// REST API
export * as Api from './api.js';

// 直播间 API
export * as Live from './live.js';

// 视频 API
export * as Video from './video.js';
export type { VideoInfo, DashStream, PlayUrlData } from './video.js';

// 用户信息 API
export * as User from './user.js';

// 动态 API
export * as Dynamic from './dynamic.js';

// 评论 API
export * as Comment from './comment.js';

// 收藏夹 API
export * as Fav from './fav.js';

// 历史记录 & 稍后再看 API
export * as History from './history.js';

// 搜索 API
export * as Search from './search.js';

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
  UnknownMessage,
  IncomingMessage,
  MessageHandler,
  TextPayload,
  ImagePayload,
  MessagePayload,
  SendMessageOptions,
  BiliBotOptions,
  ImageUploadResult,
  RawGrpcSession,
  RawGrpcMsg,
} from './types.js';

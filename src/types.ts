/**
 * @packageDocumentation
 * SDK 所有公共类型与接口定义。
 */

// ---------------------------------------------------------------------------
// 凭据
// ---------------------------------------------------------------------------

/**
 * Bilibili 账号凭据。
 *
 * 通常从登录流程或本地 JSON 文件中获取，包含 Cookie 字段与 OAuth2 令牌。
 */
export interface BiliCredentials {
  /** B站用户 UID（字符串形式）。 */
  DedeUserID: string;
  /** DedeUserID 的 MD5 校验值。 */
  DedeUserID__ckMd5?: string;
  /** OAuth2 访问令牌。 */
  access_token: string;
  /** OAuth2 刷新令牌，用于无感续期。 */
  refresh_token: string;
  /** Web 端 CSRF 令牌（即 Cookie 中的 bili_jct）。 */
  csrf: string;
  /** Web 端身份 Cookie。 */
  SESSDATA: string;
  /** 直播相关扩展字段（可选）。 */
  live?: Record<string, unknown>;
  /** 私信推送扩展字段（可选）。 */
  privatemsgpush?: Record<string, unknown>;
  /** 随机会话 ID（可选）。 */
  sid?: string;
}

// ---------------------------------------------------------------------------
// 登录
// ---------------------------------------------------------------------------

/**
 * 登录成功后返回的结果。
 */
export interface QrLoginResult {
  /** 用户 UID。 */
  DedeUserID: string;
  /** OAuth2 访问令牌。 */
  access_token: string;
  /** OAuth2 刷新令牌。 */
  refresh_token: string;
  /** CSRF 令牌。 */
  csrf?: string;
  /** Web 端身份 Cookie。 */
  SESSDATA?: string;
  /** 令牌过期时间戳（Unix 秒）。 */
  expires_in?: number;
}

// ---------------------------------------------------------------------------
// 通用 API 响应
// ---------------------------------------------------------------------------

/**
 * B站 REST API 标准响应包装。
 *
 * @typeParam T - `data` 字段的具体类型。
 */
export interface BiliApiResponse<T = unknown> {
  /** 状态码，0 表示成功。 */
  code: number;
  /** 错误信息（失败时）。 */
  message?: string;
  /** 错误信息别名（部分接口使用）。 */
  msg?: string;
  /** 响应数据。 */
  data?: T;
}

// ---------------------------------------------------------------------------
// 消息类型（接收侧）
// ---------------------------------------------------------------------------

/** 所有私信消息的公共基础字段。 */
export interface BaseMessage {
  /** 发送者 UID。 */
  senderId: number;
  /** 接收者 UID（即当前 Bot 的 UID）。 */
  receiverId: number;
  /** 消息唯一键（来自 gRPC msg_key）。 */
  msgKey: string | number;
  /** 消息序列号。 */
  seqno: string | number;
  /** 服务端时间戳（Unix 秒）。 */
  timestamp: number;
  /** 消息的纯文本摘要，用于日志/展示。 */
  rawText: string;
}

/** 纯文本私信消息。 */
export interface TextMessage extends BaseMessage {
  type: 'text';
  /** 消息文本内容。 */
  text: string;
}

/** 图片私信消息。 */
export interface ImageMessage extends BaseMessage {
  type: 'image';
  /** 图片 HTTPS URL。 */
  url: string;
  /** 图片宽度（像素）。 */
  width: number;
  /** 图片高度（像素）。 */
  height: number;
  /** 图片格式（如 `'jpeg'`）。 */
  imageType?: string;
  /** 图片文件大小（字节）。 */
  size?: number;
}

/** 分享卡片私信消息（视频、直播间等）。 */
export interface ShareMessage extends BaseMessage {
  type: 'share';
  /** 分享内容标题。 */
  title: string;
  /** 分享内容 URL。 */
  url: string;
  /** 封面图 URL（可选）。 */
  cover?: string;
  /** 分享描述（可选）。 */
  description?: string;
}

/**
 * 未知类型私信消息。
 *
 * 当收到 SDK 尚未支持的消息类型时，不丢弃而是以此类型传递，
 * 让业务层自行决定是否处理。
 */
export interface UnknownMessage extends BaseMessage {
  type: 'unknown';
  /** 原始 B站消息类型编号。 */
  msgType: number;
  /** 原始消息 content 字段（未解析的字符串）。 */
  rawContent: string;
}

/** 联合类型：所有可能收到的私信消息。 */
export type IncomingMessage = TextMessage | ImageMessage | ShareMessage | UnknownMessage;

// ---------------------------------------------------------------------------
// 消息发送 Payload（发送侧）
// ---------------------------------------------------------------------------

/**
 * 发送文本私信的 payload。
 *
 * @example
 * ```ts
 * bot.sendMsg(userId, { type: 'text', text: 'Hello!' });
 * ```
 */
export interface TextPayload {
  type: 'text';
  /** 文本内容。 */
  text: string;
}

/**
 * 发送图片私信的 payload。
 *
 * SDK 内部自动将此结构转换为 B站协议所需的 JSON 格式。
 *
 * @example
 * ```ts
 * bot.sendMsg(userId, { type: 'image', url: 'https://...', width: 800, height: 600 });
 * ```
 */
export interface ImagePayload {
  type: 'image';
  /** 图片 HTTPS URL（需提前上传到 BFS，可用 {@link uploadImage} 获取）。 */
  url: string;
  /** 图片宽度（像素，可选）。 */
  width?: number;
  /** 图片高度（像素，可选）。 */
  height?: number;
  /** 图片格式，默认 `'jpeg'`。 */
  imageType?: string;
  /** 是否发送原图，`1` 为是（默认），`0` 为否。 */
  original?: 0 | 1;
  /** 图片文件大小（字节，可选）。 */
  size?: number;
}

/** 可发送的消息 payload 联合类型。 */
export type MessagePayload = TextPayload | ImagePayload;

// ---------------------------------------------------------------------------
// Bot 配置
// ---------------------------------------------------------------------------

/**
 * {@link BiliBot} 构造函数选项。
 */
export interface BiliBotOptions {
  /** 轮询间隔（毫秒），默认 `3000`。 */
  pollInterval?: number;
  /** 并发发送队列大小，默认 `3`。 */
  sendConcurrency?: number;
  /** 是否在 token 过期时自动刷新，默认 `true`。 */
  autoRefreshToken?: boolean;
  /** HTTP 代理地址（如 `'http://127.0.0.1:7890'`）。 */
  proxy?: string;
}

/**
 * 发送消息时的可选参数。
 * @deprecated 已由 {@link MessagePayload} 替代，此接口保留用于向后兼容。
 */
export interface SendMessageOptions {
  /** HTTP 代理地址。 */
  proxy?: string;
}

/**
 * 消息处理回调函数类型。
 */
export type MessageHandler = (msg: IncomingMessage) => Promise<void> | void;

// ---------------------------------------------------------------------------
// gRPC 原始类型（内部使用）
// ---------------------------------------------------------------------------

/**
 * gRPC `GetSessions` 返回的原始会话对象。
 * @internal
 */
export interface RawGrpcSession {
  talker_id: number | string;
  session_type: number | string;
  unread_count: number | string;
  ack_seqno: number | string;
  [key: string]: unknown;
}

/**
 * gRPC `SyncFetchSessionMsgs` 返回的原始消息对象。
 * @internal
 */
export interface RawGrpcMsg {
  msg_key: number | string;
  msg_seqno: number | string;
  timestamp: number | string;
  sender_uid: number | string;
  msg_type: number | string;
  content: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 媒体
// ---------------------------------------------------------------------------

/**
 * 图片上传成功后的返回结果。
 */
export interface ImageUploadResult {
  /** HTTPS CDN 图片地址，可直接用于图片消息。 */
  image_url: string;
  /** 图片宽度（像素）。 */
  image_width: number;
  /** 图片高度（像素）。 */
  image_height: number;
  /** BFS 存储路径。 */
  location: string;
}

/**
 * 会话信息（用于 {@link BiliBot} 内部状态跟踪）。
 * @internal
 */
export interface BiliSession {
  talkerId: number;
  sessionType: number;
  unreadCount: number;
  ackSeqno: number;
}

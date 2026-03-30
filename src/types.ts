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
// 消息类型
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
}

/** 联合类型：所有可能收到的私信消息。 */
export type IncomingMessage = TextMessage | ImageMessage | ShareMessage;

// ---------------------------------------------------------------------------
// Bot 配置
// ---------------------------------------------------------------------------

/**
 * {@link BiliBot} 构造函数选项。
 */
export interface BiliBotOptions {
  /**
   * 轮询间隔（毫秒）。
   * @defaultValue 3000
   */
  pollInterval?: number;
  /**
   * 发送消息队列的最大并发数。
   * @defaultValue 3
   */
  sendConcurrency?: number;
  /**
   * 是否在令牌过期时自动刷新。
   * @defaultValue true
   */
  autoRefreshToken?: boolean;
  /** HTTP 代理地址（如 `http://127.0.0.1:7890`）。 */
  proxy?: string;
}

/**
 * 消息处理回调函数类型。
 *
 * @param msg - 收到的私信消息。
 */
export type MessageHandler = (msg: IncomingMessage) => void | Promise<void>;

/**
 * {@link BiliBot.sendText} / {@link BiliBot.sendImage} 的可选参数。
 */
export interface SendMessageOptions {
  /**
   * gRPC 会话类型。
   * - `1`：用户私信（默认）
   * - `2`：应援团消息
   */
  sessionType?: number;
}

// ---------------------------------------------------------------------------
// 直播间
// ---------------------------------------------------------------------------

/**
 * 直播间基本信息。
 */
export interface LiveRoomInfo {
  /** 直播间 ID（房间号）。 */
  room_id: number;
  /** 主播 UID。 */
  uid: number;
  /** 直播间标题。 */
  title: string;
  /** 当前直播状态：1=直播中，0=未开播，2=轮播。 */
  live_status: number;
  /** 开播时间（Unix 时间戳，未开播时为 0）。 */
  live_time: number;
  /** 直播间封面 URL。 */
  cover: string;
  /** 在线人数。 */
  online: number;
}

/**
 * 发送直播弹幕的参数。
 */
export interface SendDanmakuOptions {
  /** 弹幕颜色（十进制，默认白色 16777215）。 */
  color?: number;
  /** 弹幕字号（默认 25）。 */
  fontsize?: number;
  /** 弹幕模式（1=滚动，默认 1）。 */
  mode?: number;
}

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

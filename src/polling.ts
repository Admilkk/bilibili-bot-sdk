/**
 * @packageDocumentation
 * 私信长轮询消息循环。
 *
 * {@link MessagePoller} 持续轮询 gRPC `GetSessions` / `SyncFetchSessionMsgs` 接口，
 * 并将新私信以强类型 {@link IncomingMessage} 事件的形式向外发出。
 *
 * 重试逻辑与原始 `adapter/index.js` 保持一致：
 * 最多重试 3 次，每次退避 10 秒。
 */

import { EventEmitter } from 'events';
import * as Grpc from './grpc.js';
import type {
  BiliCredentials,
  IncomingMessage,
  TextMessage,
  ImageMessage,
  ShareMessage,
  UnknownMessage,
  RawGrpcSession,
  RawGrpcMsg,
} from './types.js';

/** 最大连续错误重试次数，超过后停止轮询。 */
const MAX_RETRY = 3;
/** 默认轮询间隔（毫秒）。 */
const POLL_INTERVAL_MS = 3_000;
/** 出错后的退避等待时间（毫秒）。 */
const RETRY_DELAY_MS = 10_000;

// B站私信消息类型常量（来自 proto 定义）
const EN_MSG_TYPE_TEXT = 1;           // 文本消息
const EN_MSG_TYPE_PIC = 2;            // 图片消息
const EN_MSG_TYPE_COMMON_SHARE_CARD = 7; // 分享卡片（旧版）
const EN_MSG_TYPE_SHARE_V2 = 11;      // 分享卡片 V2

// ---------------------------------------------------------------------------
// 事件类型定义
// ---------------------------------------------------------------------------

/**
 * {@link MessagePoller} 发出的事件映射表。
 */
export interface MessagePollerEvents {
  /** 收到新私信时触发。 */
  message: [msg: IncomingMessage];
  /** 达到最大重试次数后触发（致命错误）。 */
  error: [err: Error];
  /** 轮询干净停止后触发。 */
  stop: [];
}

// ---------------------------------------------------------------------------
// MessagePoller 类
// ---------------------------------------------------------------------------

/**
 * B站私信轮询器。
 *
 * 基于 Node.js `EventEmitter`，在后台循环拉取未读私信并触发 `message` 事件。
 *
 * @example
 * ```ts
 * import { MessagePoller } from 'bilibili-bot-sdk/polling';
 *
 * const poller = new MessagePoller(credentials);
 *
 * poller.on('message', (msg) => {
 *   console.log(`[${msg.senderId}] ${msg.rawText}`);
 * });
 *
 * poller.start();
 * // 停止：
 * poller.stop();
 * ```
 */
export class MessagePoller extends EventEmitter {
  private readonly creds: BiliCredentials;
  private readonly intervalMs: number;
  private running = false;
  private retryCount = 0;

  constructor(creds: BiliCredentials, intervalMs = POLL_INTERVAL_MS) {
    super();
    this.creds = creds;
    this.intervalMs = intervalMs;
  }

  /**
   * 启动轮询循环（幂等，重复调用无效）。
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.retryCount = 0;
    void this.loop();
  }

  /**
   * 停止轮询循环。
   */
  stop(): void {
    this.running = false;
  }

  // ---------------------------------------------------------------------------
  // 内部逻辑
  // ---------------------------------------------------------------------------

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.poll();
        this.retryCount = 0; // 成功后重置重试计数
        await this.sleep(this.intervalMs);
      } catch (err) {
        this.retryCount++;
        if (this.retryCount >= MAX_RETRY) {
          this.running = false;
          this.emit('error', err instanceof Error ? err : new Error(String(err)));
          return;
        }
        await this.sleep(RETRY_DELAY_MS);
      }
    }
    this.emit('stop');
  }

  /**
   * 执行一次完整的轮询：拉取会话 → 过滤未读 → 拉取消息 → 上报已读 → 触发事件。
   */
  private async poll(): Promise<void> {
    const sessionRes = await Grpc.getSessions(this.creds, { session_type: 4 });
    const sessions = (sessionRes?.session_list ?? []) as RawGrpcSession[];

    // 只处理用户私信（session_type=1）且有未读消息的会话
    const unread = sessions.filter(
      (s) => Number(s.session_type) === 1 && Number(s.unread_count) > 0
    );

    for (const session of unread) {
      const talkerId = Number(session.talker_id);
      const msgRes = await Grpc.getUserMessages(this.creds, talkerId, { size: 20 });
      const messages = (msgRes?.messages ?? []) as RawGrpcMsg[];

      // 只处理对方发来的消息（排除自己发出的）
      const incoming = messages.filter(
        (m) => Number(m.sender_uid) !== Number(this.creds.DedeUserID)
      );

      for (const raw of incoming) {
        this.emit('message', this.parseMessage(raw, talkerId));
      }

      // 标记已读（ack 到最后一条消息的 seqno）
      const lastSeqno = messages[messages.length - 1]?.msg_seqno;
      if (lastSeqno !== undefined) {
        await Grpc.markMessagesAsRead(this.creds, talkerId, { ack_seqno: Number(lastSeqno) });
      }
    }
  }

  /**
   * 将原始 gRPC 消息对象解析为 {@link IncomingMessage}。
   *
   * @param raw - 原始消息对象。
   * @param talkerId - 会话对方 UID（用于补全 senderId）。
   * @returns 解析后的消息，无法识别类型时返回 `null`。
   */
  private parseMessage(raw: RawGrpcMsg, talkerId: number): IncomingMessage {
    const base = {
      msgKey: String(raw.msg_key),
      seqno: Number(raw.msg_seqno),
      senderId: Number(raw.sender_uid) || talkerId,
      receiverId: Number(this.creds.DedeUserID),
      timestamp: Number(raw.timestamp),
    };

    let content: Record<string, unknown> = {};
    try {
      content = JSON.parse(raw.content as string);
    } catch {
      // content 不是 JSON，按文本处理
    }

    const msgType = Number(raw.msg_type);

    if (msgType === EN_MSG_TYPE_TEXT) {
      const text = (content.content as string) ?? String(raw.content);
      return {
        ...base,
        type: 'text',
        text,
        rawText: text,
      } satisfies TextMessage;
    }

    if (msgType === EN_MSG_TYPE_PIC) {
      return {
        ...base,
        type: 'image',
        url: (content.url as string) ?? '',
        width: Number(content.width ?? 0),
        height: Number(content.height ?? 0),
        imageType: (content.imageType as string) ?? undefined,
        size: content.size !== undefined ? Number(content.size) : undefined,
        rawText: '[图片]',
      } satisfies ImageMessage;
    }

    if (msgType === EN_MSG_TYPE_COMMON_SHARE_CARD || msgType === EN_MSG_TYPE_SHARE_V2) {
      const title = (content.title as string) ?? '';
      return {
        ...base,
        type: 'share',
        title,
        url: (content.source as string) ?? (content.native_uri as string) ?? '',
        cover: (content.img_url as string) ?? undefined,
        description: (content.desc as string) ?? undefined,
        rawText: `[分享] ${title}`,
      } satisfies ShareMessage;
    }

    // 未知消息类型：不丢弃，以 unknown 类型传递给用户
    return {
      ...base,
      type: 'unknown',
      msgType,
      rawContent: String(raw.content),
      rawText: `[未知消息类型:${msgType}]`,
    } satisfies UnknownMessage;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

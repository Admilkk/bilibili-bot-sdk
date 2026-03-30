/**
 * @packageDocumentation
 * 高层 BiliBot 客户端——SDK 的主入口。
 *
 * `BiliBot` 将 {@link MessagePoller}、gRPC 发送、媒体上传封装成
 * 一个简洁的接口，风格类似 Telegram Bot SDK。
 */

import PQueue from 'p-queue';
import { MessagePoller } from './polling.js';
import * as Grpc from './grpc.js';
import { uploadImage } from './media.js';
import { refreshToken } from './auth.js';
import type {
  BiliCredentials,
  IncomingMessage,
  SendMessageOptions,
  BiliBotOptions,
  MessageHandler,
} from './types.js';

/**
 * B站 Bot 主客户端。
 *
 * 每个 B站账号对应一个实例。多账号并发请使用 {@link BiliBotManager}。
 *
 * @example
 * ```ts
 * import { BiliBot } from 'bilibili-bot-sdk';
 *
 * const bot = new BiliBot(credentials, { pollInterval: 3000 });
 *
 * bot.onMessage(async (msg) => {
 *   if (msg.type === 'text' && msg.text === 'ping') {
 *     await bot.sendText(msg.senderId, 'pong');
 *   }
 * });
 *
 * bot.start();
 * ```
 */
export class BiliBot {
  /** 当前 Bot 使用的凭据（只读）。 */
  readonly creds: BiliCredentials;

  private readonly opts: Required<BiliBotOptions>;
  private readonly poller: MessagePoller;
  private readonly sendQueue: PQueue;
  private readonly handlers: MessageHandler[] = [];
  private started = false;

  constructor(creds: BiliCredentials, opts: BiliBotOptions = {}) {
    this.creds = creds;
    this.opts = {
      pollInterval: opts.pollInterval ?? 3_000,
      sendConcurrency: opts.sendConcurrency ?? 3,
      autoRefreshToken: opts.autoRefreshToken ?? true,
      proxy: opts.proxy ?? undefined,
    } as Required<BiliBotOptions>;

    this.poller = new MessagePoller(creds, { intervalMs: this.opts.pollInterval });
    this.sendQueue = new PQueue({ concurrency: this.opts.sendConcurrency });

    // 将轮询事件分发给所有已注册的处理器
    this.poller.on('message', (msg: IncomingMessage) => {
      for (const handler of this.handlers) {
        this.sendQueue.add(() => handler(msg)).catch(() => void 0);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 生命周期
  // ---------------------------------------------------------------------------

  /**
   * 启动消息轮询。调用后将持续接收私信。
   *
   * @returns `this`，支持链式调用。
   */
  start(): this {
    if (this.started) return this;
    this.started = true;
    this.poller.start();
    return this;
  }

  /**
   * 停止消息轮询，等待发送队列清空后返回。
   */
  async stop(): Promise<void> {
    this.poller.stop();
    await this.sendQueue.onIdle();
    this.started = false;
  }

  // ---------------------------------------------------------------------------
  // 消息处理
  // ---------------------------------------------------------------------------

  /**
   * 注册一个消息处理回调。可多次调用来注册多个处理器，按注册顺序触发。
   *
   * @param handler - 消息处理函数。
   * @returns `this`，支持链式调用。
   */
  onMessage(handler: MessageHandler): this {
    this.handlers.push(handler);
    return this;
  }

  // ---------------------------------------------------------------------------
  // 发送消息
  // ---------------------------------------------------------------------------

  /**
   * 向指定用户发送文本私信。
   *
   * @param receiverId - 接收方 UID。
   * @param text - 文本内容。
   * @param opts - 可选发送参数。
   */
  async sendText(
    receiverId: number,
    text: string,
    opts: SendMessageOptions = {}
  ): Promise<unknown> {
    return this.sendQueue.add(() =>
      Grpc.sendMsg(this.creds, { content: text }, receiverId, 1, opts)
    );
  }

  /**
   * 向指定用户发送图片私信。
   *
   * 传入图片 Buffer，SDK 自动上传到 BFS 后发送。
   *
   * @param receiverId - 接收方 UID。
   * @param imageBuffer - 图片文件的 Buffer 数据。
   * @param opts - 可选发送参数。
   */
  async sendImage(
    receiverId: number,
    imageBuffer: Buffer,
    opts: SendMessageOptions = {}
  ): Promise<unknown> {
    const uploaded = await uploadImage(imageBuffer, this.creds, this.opts.proxy);
    return this.sendQueue.add(() =>
      Grpc.sendMsg(
        this.creds,
        {
          url: uploaded.image_url,
          height: String(uploaded.image_height),
          width: String(uploaded.image_width),
        },
        receiverId,
        2,
        opts
      )
    );
  }

  /**
   * 撤回一条已发送的私信。
   *
   * @param receiverId - 对方 UID。
   * @param msgKey - 消息的 `msg_key`（由发送接口返回）。
   */
  async recallMsg(receiverId: number, msgKey: string): Promise<unknown> {
    return Grpc.recallMsg(this.creds, receiverId, msgKey);
  }

  /**
   * 将与某用户的对话标记为已读。
   *
   * @param talkerId - 对方 UID。
   * @param ackSeqno - 已读到的消息序列号。
   */
  async markRead(talkerId: number, ackSeqno: number): Promise<unknown> {
    return Grpc.markMessagesAsRead(this.creds, talkerId, { ack_seqno: ackSeqno });
  }

  // ---------------------------------------------------------------------------
  // Token 管理
  // ---------------------------------------------------------------------------

  /**
   * 刷新 access_token，并更新当前实例的凭据（in-place）。
   *
   * @returns 刷新后的新凭据。
   */
  async refreshToken(): Promise<BiliCredentials> {
    const newCreds = await refreshToken(this.creds);
    Object.assign(this.creds, newCreds);
    return this.creds;
  }
}

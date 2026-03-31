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
import * as LiveApi from './live.js';
import * as VideoApi from './video.js';
import * as ApiModule from './api.js';
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

  /**
   * 直播间相关 API，凭据已绑定，无需手动传入。
   *
   * @example
   * ```ts
   * await bot.live.sendDanmu(roomId, '你好');
   * const info = await bot.live.getRoomInfo(roomId);
   * ```
   */
  readonly live: BotLiveFacade;

  /**
   * 视频相关 API，凭据已绑定，无需手动传入。
   *
   * @example
   * ```ts
   * const info = await bot.video.getVideoInfo({ bvid: 'BV1xx...' });
   * ```
   */
  readonly video: BotVideoFacade;

  /**
   * 通用 REST API，凭据已绑定，无需手动传入。
   *
   * @example
   * ```ts
   * await bot.api.likeVideo(aid);
   * await bot.api.followUser(uid);
   * ```
   */
  readonly api: BotApiFacade;

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

    this.poller = new MessagePoller(creds, this.opts.pollInterval);
    this.live = new BotLiveFacade(creds, this.opts.proxy);
    this.video = new BotVideoFacade(creds, this.opts.proxy);
    this.api = new BotApiFacade(creds, this.opts.proxy);
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
      Grpc.sendMsg(this.creds, receiverId, { type: 'text', text })
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
      Grpc.sendMsg(this.creds, receiverId, {
        type: 'image',
        url: uploaded.image_url,
        width: uploaded.image_width,
        height: uploaded.image_height,
      })
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
    const res = await refreshToken(this.creds.access_token, this.creds.refresh_token, this.opts.proxy);
    if (res.code === 0 && res.data) {
      Object.assign(this.creds, res.data);
    }
    return this.creds;
  }
}

// ---------------------------------------------------------------------------
// Facade 类：绑定凭据，简化调用
// ---------------------------------------------------------------------------

/** 直播间 API facade，由 {@link BiliBot} 自动创建并绑定凭据。 */
export class BotLiveFacade {
  constructor(private readonly creds: BiliCredentials, private readonly proxy?: string) {}

  sendDanmu(roomId: number, message: string, options?: Parameters<typeof LiveApi.sendDanmu>[3]) {
    return LiveApi.sendDanmu(this.creds, roomId, message, options);
  }
  getRoomInfo(roomId: number) {
    return LiveApi.getRoomInfo(this.creds, roomId, this.proxy);
  }
  likeLiveRoom(roomId: number, clickCount = 1) {
    return LiveApi.likeLiveRoom(this.creds, roomId, clickCount, this.proxy);
  }
  getDanmuHistory(roomId: number) {
    return LiveApi.getDanmuHistory(this.creds, roomId, this.proxy);
  }
  getUserLiveInfo(uid: number) {
    return LiveApi.getUserLiveInfo(uid, this.creds, this.proxy);
  }
  liveShare(roomId: number) {
    return LiveApi.liveShare(this.creds, roomId, this.proxy);
  }
}

/** 视频 API facade，由 {@link BiliBot} 自动创建并绑定凭据。 */
export class BotVideoFacade {
  constructor(private readonly creds: BiliCredentials, private readonly proxy?: string) {}

  getVideoInfo(idOrBvid: string | number) {
    return VideoApi.getVideoInfo(idOrBvid, this.creds, this.proxy);
  }
  getVideoDetail(aid: number) {
    return VideoApi.getVideoDetail(aid, this.creds, this.proxy);
  }
  getPlayUrl(aid: number, cid: number, options?: Parameters<typeof VideoApi.getPlayUrl>[3]) {
    return VideoApi.getPlayUrl(this.creds, aid, cid, options);
  }
  searchVideo(keyword: string, options?: Parameters<typeof VideoApi.searchVideo>[2]) {
    return VideoApi.searchVideo(this.creds, keyword, options);
  }
}

/** 通用 REST API facade，由 {@link BiliBot} 自动创建并绑定凭据。 */
export class BotApiFacade {
  constructor(private readonly creds: BiliCredentials, private readonly proxy?: string) {}

  getMyInfo() { return ApiModule.getMyInfo(this.creds, this.proxy); }
  getMyInfo2() { return ApiModule.getMyInfo2(this.creds, this.proxy); }
  getSpace(uid: number) { return ApiModule.getSpace(this.creds, uid, this.proxy); }
  likeVideo(aid: number, like = true) { return ApiModule.likeVideo(this.creds, aid, like, this.proxy); }
  dislikeVideo(aid: number) { return ApiModule.dislikeVideo(this.creds, aid, this.proxy); }
  addCoin(aid: number, multiply: 1 | 2 = 1) { return ApiModule.addCoin(this.creds, aid, multiply, this.proxy); }
  tripleVideo(aid: number) { return ApiModule.tripleVideo(this.creds, aid, this.proxy); }
  shareVideo(aid: number) { return ApiModule.shareVideo(this.creds, aid, this.proxy); }
  modifyRelation(uid: number, action: 1 | 2 | 3 | 5 | 6 | 7) { return ApiModule.modifyRelation(this.creds, uid, action, this.proxy); }
  signManga() { return ApiModule.signManga(this.creds, this.proxy); }
  addVipExperience() { return ApiModule.addVipExperience(this.creds, this.proxy); }
  receiveVipPrivilege(type: number) { return ApiModule.receiveVipPrivilege(this.creds, type, this.proxy); }
  getExpReward() { return ApiModule.getExpReward(this.creds, this.proxy); }
  reportWatch(aid: number, cid: number, progress?: number) { return ApiModule.reportWatch(this.creds, aid, cid, progress, this.proxy); }
  replyVideo(aid: number, message: string) { return ApiModule.replyVideo(this.creds, aid, message, this.proxy); }
  unfavVideo(aid: number) { return ApiModule.unfavVideo(this.creds, aid, this.proxy); }
  favVideo(aid: number) { return ApiModule.favVideo(this.creds, aid, this.proxy); }
  getFeed(options?: Parameters<typeof ApiModule.getFeed>[1]) { return ApiModule.getFeed(this.creds, options); }
  getLiveFeed(options?: Parameters<typeof ApiModule.getLiveFeed>[1]) { return ApiModule.getLiveFeed(this.creds, options); }
}

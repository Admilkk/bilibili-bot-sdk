/**
 * @packageDocumentation
 * 多账号 Bot 池管理器。
 *
 * {@link BiliBotManager} 从凭据目录批量读取账号，
 * 用 PQueue 控制并发上线，并统一管理所有 {@link BiliBot} 实例的生命周期。
 */

import fs from 'fs';
import path from 'path';
import PQueue from 'p-queue';
import { BiliBot } from './client.js';
import type { BiliCredentials, BiliBotOptions, MessageHandler } from './types.js';

// ---------------------------------------------------------------------------
// 凭据文件工具
// ---------------------------------------------------------------------------

/**
 * 凭据 JSON 文件的结构：`{ "UID": { ...BiliCredentials } }`。
 *
 * @example
 * ```json
 * {
 *   "123456789": { "DedeUserID": "123456789", "access_token": "...", ... }
 * }
 * ```
 */
export type CredentialFile = Record<string, BiliCredentials>;

/**
 * 读取并解析单个凭据 JSON 文件。
 *
 * @param filePath - 凭据文件的绝对路径。
 * @returns UID → 凭据 的映射对象。
 */
export function loadCredentialFile(filePath: string): CredentialFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CredentialFile;
}

/**
 * 扫描目录，加载其中所有 `*.json` 凭据文件（排除 `本子信息.json`）。
 *
 * @param dir - 要扫描的目录路径。
 * @returns `{ filePath, credentials }` 数组。
 */
export function loadCredentialDir(
  dir: string
): Array<{ filePath: string; credentials: BiliCredentials[] }> {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== '本子信息.json');

  return files.map((file) => {
    const filePath = path.join(dir, file);
    const store = loadCredentialFile(filePath);
    return {
      filePath,
      credentials: Object.values(store),
    };
  });
}

// ---------------------------------------------------------------------------
// 管理器选项
// ---------------------------------------------------------------------------

/**
 * {@link BiliBotManager} 的构造选项。
 */
export interface BiliBotManagerOptions extends BiliBotOptions {
  /**
   * 同时上线的最大 Bot 数量，默认 `5`。
   * 对应原 `adapter/index.js` 的 `PQueue({ concurrency: 5 })`。
   */
  concurrency?: number;
}

// ---------------------------------------------------------------------------
// 管理器
// ---------------------------------------------------------------------------

/**
 * 多账号 Bot 池管理器。
 *
 * 从一个凭据目录批量加载账号，并发上线，统一分发消息处理回调。
 *
 * @example
 * ```ts
 * import { BiliBotManager } from 'bilibili-bot-sdk';
 *
 * const manager = new BiliBotManager({ concurrency: 5 });
 * manager.loadDir('./data/bili');
 *
 * manager.onMessage(async (msg) => {
 *   console.log(`[Bot ${msg.botId}] 收到消息: ${msg.rawText}`);
 * });
 *
 * await manager.startAll();
 * ```
 */
export class BiliBotManager {
  private readonly opts: Required<BiliBotManagerOptions>;
  private readonly bots: Map<string, BiliBot> = new Map();
  private readonly handlers: MessageHandler[] = [];

  constructor(opts: BiliBotManagerOptions = {}) {
    this.opts = {
      pollInterval: opts.pollInterval ?? 3_000,
      sendConcurrency: opts.sendConcurrency ?? 3,
      autoRefreshToken: opts.autoRefreshToken ?? true,
      proxy: opts.proxy ?? undefined,
      concurrency: opts.concurrency ?? 5,
    } as Required<BiliBotManagerOptions>;
  }

  // ---------------------------------------------------------------------------
  // 加载账号
  // ---------------------------------------------------------------------------

  /**
   * 注册单个凭据，创建对应的 {@link BiliBot} 实例（但不立即启动）。
   *
   * @param creds - 账号凭据。
   */
  addBot(creds: BiliCredentials): this {
    const bot = new BiliBot(creds, this.opts);
    // 将全局处理器注册到新 Bot
    for (const h of this.handlers) bot.onMessage(h);
    this.bots.set(creds.DedeUserID, bot);
    return this;
  }

  /**
   * 从凭据文件批量注册账号。
   *
   * @param filePath - 凭据 JSON 文件路径。
   */
  loadFile(filePath: string): this {
    const store = loadCredentialFile(filePath);
    for (const creds of Object.values(store)) this.addBot(creds);
    return this;
  }

  /**
   * 扫描目录，批量注册所有 `*.json` 中的账号。
   *
   * @param dir - 凭据目录路径。
   */
  loadDir(dir: string): this {
    for (const { credentials } of loadCredentialDir(dir)) {
      for (const creds of credentials) this.addBot(creds);
    }
    return this;
  }

  // ---------------------------------------------------------------------------
  // 消息处理
  // ---------------------------------------------------------------------------

  /**
   * 注册全局消息处理回调，对所有 Bot 实例生效。
   *
   * @param handler - 消息处理函数。
   */
  onMessage(handler: MessageHandler): this {
    this.handlers.push(handler);
    // 同步注册到已有实例
    for (const bot of this.bots.values()) bot.onMessage(handler);
    return this;
  }

  // ---------------------------------------------------------------------------
  // 生命周期
  // ---------------------------------------------------------------------------

  /**
   * 以受控并发（由 `concurrency` 选项决定）启动所有 Bot。
   *
   * 等待所有 Bot 的轮询循环完成初始化后返回。
   */
  async startAll(): Promise<void> {
    const queue = new PQueue({ concurrency: this.opts.concurrency });
    for (const bot of this.bots.values()) {
      queue.add(() => Promise.resolve(bot.start()));
    }
    await queue.onIdle();
  }

  /**
   * 停止所有 Bot，等待发送队列全部清空。
   */
  async stopAll(): Promise<void> {
    await Promise.all([...this.bots.values()].map((b) => b.stop()));
  }

  /**
   * 获取指定 UID 对应的 {@link BiliBot} 实例。
   *
   * @param uid - 账号 UID（字符串形式）。
   */
  getBot(uid: string): BiliBot | undefined {
    return this.bots.get(uid);
  }

  /** 当前已注册的 Bot 数量。 */
  get size(): number {
    return this.bots.size;
  }
}

/**
 * @packageDocumentation
 * 加密与签名工具模块。
 *
 * 包含：
 * - MD5 + HMAC-SHA256 请求签名
 * - B站 EID（加密用户标识）生成
 * - Trace-ID 生成
 * - Web Ticket 获取（gRPC 鉴权用）
 */

import { createHash, createHmac } from 'node:crypto';
import { fetchRequest } from './http.js';
import type { BiliCredentials } from './types.js';

// ---------------------------------------------------------------------------
// MD5 签名
// ---------------------------------------------------------------------------

/**
 * 对参数对象进行 MD5 签名（B站 Android App 鉴权标准流程）。
 *
 * 流程：将所有参数按 key 字典序排列 → URLSearchParams 序列化 → 拼接 appSecret → MD5。
 *
 * @param params - 请求参数对象（不含 sign 字段）。
 * @param appSecret - App 密钥。
 * @returns 32 位小写 MD5 签名字符串。
 */
export function signParams(
  params: Record<string, string | number>,
  appSecret: string
): string {
  const sp = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  );
  sp.sort();
  return createHash('md5')
    .update(sp.toString() + appSecret)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// HMAC-SHA256
// ---------------------------------------------------------------------------

/**
 * 计算 HMAC-SHA256。
 *
 * @param key - 密钥字符串。
 * @param message - 待签名消息。
 * @returns 十六进制摘要字符串。
 */
export function hmacSha256(key: string, message: string): string {
  return createHmac('sha256', key).update(message).digest('hex');
}

// ---------------------------------------------------------------------------
// EID 生成
// ---------------------------------------------------------------------------

/**
 * 生成 B站 `x-bili-aurora-eid` 请求头的值。
 *
 * 算法：对 UID 字符串每个字符做 XOR 移位编码后 Base64。
 *
 * @param uid - 用户 UID 字符串。
 * @returns EID 字符串。
 */
export function generateEid(uid: string): string {
  const n = uid
    ? uid
        .split('')
        .map((c, i) =>
          String.fromCharCode(c.charCodeAt(0) ^ [69, 69, 73, 39, 65, 69][i % 6])
        )
        .join('')
    : '';
  return n ? Buffer.from(n).toString('base64') : '';
}

// ---------------------------------------------------------------------------
// Trace-ID 生成
// ---------------------------------------------------------------------------

/**
 * 生成 B站 `x-bili-trace-id` 请求头的值。
 *
 * 格式：`<16位随机十六进制>:<16位随机十六进制>:0:0`
 *
 * @returns Trace-ID 字符串。
 */
export function generateTraceId(): string {
  const rand = () =>
    Math.floor(Math.random() * 0xffffffffffffffff)
      .toString(16)
      .padStart(16, '0');
  const id = rand();
  return `${id}:${id}:0:0`;
}

// ---------------------------------------------------------------------------
// Web Ticket（gRPC 鉴权令牌）
// ---------------------------------------------------------------------------

/** Web Ticket 缓存（uid → {ticket, expire}）。 */
const ticketCache = new Map<string, { ticket: string; expire: number }>();

/**
 * 获取 Web Ticket，用于 gRPC 调用的 `x-bili-ticket` 请求头。
 *
 * 结果会缓存至过期前 5 分钟，避免频繁请求。
 *
 * @param creds - 用户凭据。
 * @returns 包含 `ticket` 字段的对象，失败时返回 `null`。
 */
export async function generateWebTicket(
  creds: BiliCredentials
): Promise<{ ticket: string } | null> {
  const uid = creds.DedeUserID;
  const cached = ticketCache.get(uid);
  if (cached && cached.expire > Date.now()) return { ticket: cached.ticket };

  try {
    const ts = Math.floor(Date.now() / 1000);
    const hexSign = hmacSha256('XgwSnGZ1p', String(ts));
    const res = await fetchRequest<{
      code: number;
      data?: { ticket: string; created_at: number; ttl: number };
    }>({
      url: 'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket',
      method: 'GET',
      params: {
        key_id: 'ec02',
        hexsign: hexSign,
        'context[ts]': String(ts),
        'context[as_respond_type]': 'protobuf',
        csrf: creds.csrf,
      },
      extraHeaders: {
        Cookie: `SESSDATA=${creds.SESSDATA}; bili_jct=${creds.csrf}; DedeUserID=${uid}`,
      },
      needSign: false,
    });

    if (res?.code === 0 && res.data?.ticket) {
      const ttl = (res.data.ttl - 300) * 1000; // 提前 5 分钟过期
      ticketCache.set(uid, { ticket: res.data.ticket, expire: Date.now() + ttl });
      return { ticket: res.data.ticket };
    }
  } catch {
    // 降级：无 ticket 时 gRPC 仍可能正常工作
  }
  return null;
}

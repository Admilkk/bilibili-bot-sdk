/**
 * @packageDocumentation
 * B站登录与鉴权模块。
 *
 * 支持三种登录方式：
 * 1. **TV 二维码登录** —— 适合机器人账号，Android App 扫码授权
 * 2. **Web 二维码登录** —— 手机 App 扫描网页二维码
 * 3. **Access Token 刷新** —— 无感续期，避免频繁重新登录
 */

import { fetchRequest } from './http.js';
import type { BiliApiResponse, BiliCredentials, QrLoginResult } from './types.js';

// ---------------------------------------------------------------------------
// 接口地址
// ---------------------------------------------------------------------------

const TV_QR_GET_URL = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code';
const TV_QR_POLL_URL = 'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll';
const WEB_QR_GET_URL = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate';
const WEB_QR_POLL_URL = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll';
const TOKEN_REFRESH_URL = 'https://passport.bilibili.com/x/passport-login/oauth2/refresh_token';

/** TV 模式专用 appkey（与主 App 不同）。 */
const TV_APP_KEY = 'iVGUTjsxvpLeuDCf';
/** TV 模式专用 appSecret。 */
const TV_APP_SECRET = 'aHRmhWMLkdeMuILqORnYZocwMBpMEOdt';

// ---------------------------------------------------------------------------
// TV 二维码登录
// ---------------------------------------------------------------------------

/** TV 授权码响应数据。 */
interface TvAuthCodeData {
  /** 可嵌入二维码的 URL 字符串。 */
  url: string;
  /** 授权码，需交给用户扫描。 */
  auth_code: string;
}

/**
 * 申请一个新的 TV 模式二维码授权码。
 *
 * 获取到的 `auth_code` 应编码为二维码图片展示给用户，
 * 用户用 B站 Android App 扫描后调用 {@link pollTvQrLogin} 轮询结果。
 *
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 包含 `url` 和 `auth_code` 的响应。
 */
export async function getTvQrCode(
  proxy?: string
): Promise<BiliApiResponse<TvAuthCodeData>> {
  return fetchRequest<BiliApiResponse<TvAuthCodeData>>({
    url: TV_QR_GET_URL,
    method: 'POST',
    params: {
      local_id: '0',
      ts: Math.floor(Date.now() / 1000),
    },
    appKey: TV_APP_KEY,
    appSecret: TV_APP_SECRET,
    proxy,
  });
}

/**
 * 轮询 TV 二维码扫描状态。
 *
 * - code `0`：登录成功，`data` 中包含令牌
 * - code `86039`：二维码未扫描
 * - code `86038`：二维码已过期
 * - code `86090`：已扫描但未确认
 *
 * @param authCode - 由 {@link getTvQrCode} 获取的授权码。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 轮询响应（登录成功时 data 含令牌信息）。
 */
export async function pollTvQrLogin(
  authCode: string,
  proxy?: string
): Promise<BiliApiResponse<QrLoginResult>> {
  return fetchRequest<BiliApiResponse<QrLoginResult>>({
    url: TV_QR_POLL_URL,
    method: 'POST',
    params: {
      auth_code: authCode,
      local_id: '0',
      ts: Math.floor(Date.now() / 1000),
    },
    appKey: TV_APP_KEY,
    appSecret: TV_APP_SECRET,
    proxy,
  });
}

// ---------------------------------------------------------------------------
// Web 二维码登录
// ---------------------------------------------------------------------------

/** Web 二维码生成响应数据。 */
interface WebQrData {
  /** 可嵌入二维码的 URL 字符串。 */
  url: string;
  /** 轮询用的二维码 key。 */
  qrcode_key: string;
}

/**
 * 生成 Web 端登录二维码。
 *
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 包含 `url` 和 `qrcode_key` 的响应。
 */
export async function getWebQrCode(
  proxy?: string
): Promise<BiliApiResponse<WebQrData>> {
  return fetchRequest<BiliApiResponse<WebQrData>>({
    url: WEB_QR_GET_URL,
    method: 'GET',
    needSign: false,
    extraHeaders: {
      Referer: 'https://www.bilibili.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
    proxy,
  });
}

/**
 * 轮询 Web 二维码扫描状态。
 *
 * - code `0`：登录成功
 * - code `86101`：未扫描
 * - code `86090`：已扫描但未确认
 * - code `86038`：二维码已过期
 *
 * @param qrcodeKey - 由 {@link getWebQrCode} 获取的 `qrcode_key`。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 轮询响应（登录成功时 data 含 Cookie 信息）。
 */
export async function pollWebQrLogin(
  qrcodeKey: string,
  proxy?: string
): Promise<BiliApiResponse<{ url?: string; refresh_token?: string; timestamp?: number; code?: number; message?: string }>> {
  return fetchRequest({
    url: WEB_QR_POLL_URL,
    method: 'GET',
    params: { qrcode_key: qrcodeKey },
    needSign: false,
    extraHeaders: {
      Referer: 'https://www.bilibili.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
    proxy,
  });
}

// ---------------------------------------------------------------------------
// Token 刷新
// ---------------------------------------------------------------------------

/**
 * 刷新 Access Token。
 *
 * 建议在收到 token 即将过期的信号时调用，或定期（每 25 天）调用一次。
 *
 * @param accessToken - 当前 access_token。
 * @param refreshToken - 当前 refresh_token。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 刷新响应（成功时 data 含新的 access_token 和 refresh_token）。
 */
export async function refreshToken(
  accessToken: string,
  refreshToken_: string,
  proxy?: string
): Promise<BiliApiResponse<{ access_token: string; refresh_token: string; expires_in: number }>> {
  return fetchRequest({
    url: TOKEN_REFRESH_URL,
    method: 'POST',
    params: {
      access_key: accessToken,
      refresh_token: refreshToken_,
      ts: Math.floor(Date.now() / 1000),
    },
    // 刷新接口使用固定的专用签名密钥对
    appKey: '783bbb7264451d82',
    appSecret: '2653583c8873dea268ab9386918b1d65',
    proxy,
  });
}

// ---------------------------------------------------------------------------
// Cookie 解析工具
// ---------------------------------------------------------------------------

/**
 * 从 Set-Cookie 字符串（或分号拼接的 Cookie 字符串）中解析出 {@link BiliCredentials} 所需的字段。
 *
 * @param cookieString - 原始 Cookie 字符串（来自登录响应头）。
 * @param existing - 需要合并的已有凭据（如 access_token 来自 JSON 响应）。
 * @returns 合并后的部分凭据对象。
 *
 * @example
 * ```ts
 * const creds = parseCookieString(
 *   'SESSDATA=abc; bili_jct=def; DedeUserID=123',
 *   { access_token: 'xyz', refresh_token: 'uvw' }
 * );
 * ```
 */
export function parseCookieString(
  cookieString: string,
  existing: Partial<BiliCredentials> = {}
): Partial<BiliCredentials> {
  const result: Partial<BiliCredentials> = { ...existing };
  for (const pair of cookieString.split(/[;,]/)) {
    const [rawKey, ...rest] = pair.trim().split('=');
    const key = rawKey?.trim();
    const value = rest.join('=').trim();
    if (!key || !value) continue;
    if (key === 'SESSDATA') result.SESSDATA = decodeURIComponent(value);
    else if (key === 'bili_jct') result.csrf = value;
    else if (key === 'DedeUserID') result.DedeUserID = value;
    else if (key === 'DedeUserID__ckMd5') result.DedeUserID__ckMd5 = value;
    else if (key === 'sid') result.sid = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// BiliAuth 类（面向对象入口）
// ---------------------------------------------------------------------------

/**
 * B站认证助手类，封装了完整的登录轮询流程。
 *
 * @example
 * ```ts
 * import { BiliAuth } from 'bilibili-bot-sdk';
 *
 * const auth = new BiliAuth();
 * const { url, authCode } = await auth.startTvQrLogin();
 * // 将 url 生成二维码展示给用户...
 *
 * const creds = await auth.waitForTvQrScan(authCode);
 * console.log('登录成功，UID:', creds.DedeUserID);
 * ```
 */
export class BiliAuth {
  private readonly proxy?: string;

  constructor(proxy?: string) {
    this.proxy = proxy;
  }

  /**
   * 申请 TV 二维码并返回二维码 URL 和授权码。
   *
   * @returns `{ url, authCode }` —— url 用于生成二维码图片，authCode 用于轮询。
   */
  async startTvQrLogin(): Promise<{ url: string; authCode: string }> {
    const res = await getTvQrCode(this.proxy);
    if (res.code !== 0 || !res.data) {
      throw new Error(`获取 TV 二维码失败: ${res.message ?? res.msg ?? res.code}`);
    }
    return { url: res.data.url, authCode: res.data.auth_code };
  }

  /**
   * 轮询 TV 二维码扫描结果，直至成功或超时。
   *
   * @param authCode - 由 {@link startTvQrLogin} 获取的授权码。
   * @param timeoutMs - 超时毫秒数（默认 120 秒）。
   * @param intervalMs - 轮询间隔毫秒数（默认 3 秒）。
   * @returns 登录成功后的凭据对象。
   * @throws 超时或二维码过期时抛出错误。
   */
  async waitForTvQrScan(
    authCode: string,
    timeoutMs = 120_000,
    intervalMs = 3_000
  ): Promise<QrLoginResult> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await pollTvQrLogin(authCode, this.proxy);
      if (res.code === 0 && res.data) return res.data;
      if (res.code === 86038) throw new Error('TV 二维码已过期，请重新获取');
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('TV 二维码扫描超时');
  }

  /**
   * 生成 Web 二维码并返回二维码 URL 和 key。
   */
  async startWebQrLogin(): Promise<{ url: string; qrcodeKey: string }> {
    const res = await getWebQrCode(this.proxy);
    if (res.code !== 0 || !res.data) {
      throw new Error(`获取 Web 二维码失败: ${res.message ?? res.msg ?? res.code}`);
    }
    return { url: res.data.url, qrcodeKey: res.data.qrcode_key };
  }

  /**
   * 轮询 Web 二维码扫描结果。
   *
   * @param qrcodeKey - 由 {@link startWebQrLogin} 获取的 key。
   * @param cookieCallback - 可选回调，每次收到 Set-Cookie 时触发，用于持久化 Cookie。
   * @param timeoutMs - 超时毫秒数（默认 120 秒）。
   * @param intervalMs - 轮询间隔毫秒数（默认 3 秒）。
   * @returns 登录成功后的部分凭据（需进一步调用 {@link parseCookieString} 补全）。
   */
  async waitForWebQrScan(
    qrcodeKey: string,
    cookieCallback?: (cookie: string) => void,
    timeoutMs = 120_000,
    intervalMs = 3_000
  ): Promise<Partial<BiliCredentials>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await pollWebQrLogin(qrcodeKey, this.proxy);
      if (res.code === 0) {
        // Web 登录成功，Cookie 包含在 url redirect 的 Set-Cookie 中
        const url = (res.data as any)?.url ?? '';
        const partial = parseCookieString(url);
        if (cookieCallback) cookieCallback(url);
        return partial;
      }
      if ((res.data as any)?.code === 86038) throw new Error('Web 二维码已过期');
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Web 二维码扫描超时');
  }

  /**
   * 刷新访问令牌。
   *
   * @param creds - 当前凭据。
   * @returns 更新了 access_token / refresh_token 的新凭据对象。
   */
  async refresh(creds: BiliCredentials): Promise<BiliCredentials> {
    const res = await refreshToken(creds.access_token, creds.refresh_token, this.proxy);
    if (res.code !== 0 || !res.data) {
      throw new Error(`Token 刷新失败: ${res.message ?? res.msg ?? res.code}`);
    }
    return {
      ...creds,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
    };
  }
}

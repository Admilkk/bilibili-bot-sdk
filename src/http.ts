/**
 * @packageDocumentation
 * 带签名的 HTTP 请求封装（Axios）。
 *
 * 所有对 B站 REST API 的请求均通过 {@link fetchRequest} 发出，
 * 它会自动完成 MD5 签名、请求头注入和代理设置。
 */

import axios, { type AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { signParams } from './crypto.js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** B站 Android App 默认 appkey。 */
export const DEFAULT_APP_KEY = '1d8b6e7d45233436';
/** B站 Android App 默认 appSecret。 */
export const DEFAULT_APP_SECRET = '560c52ccd288fed045859ed18bffd973';

/** Android App 默认请求头。 */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 BiliDroid/8.2.0 (bbcallen@gmail.com) os/android model/24031PN0DC mobi_app/android build/8020300 channel/yingyongbao innerVer/8020300 osVer/12 network/2',
  'Content-Type': 'application/x-www-form-urlencoded',
};

// ---------------------------------------------------------------------------
// 请求选项类型
// ---------------------------------------------------------------------------

/**
 * {@link fetchRequest} 的选项。
 */
export interface FetchRequestOptions {
  /** 请求 URL。 */
  url: string;
  /** HTTP 方法，默认 `'GET'`。 */
  method?: 'GET' | 'POST';
  /** URL 查询参数（GET）或表单参数（POST，当 bodyParams 未指定时）。 */
  params?: Record<string, string | number>;
  /** POST body 参数（优先级高于 params，仅 POST 有效）。 */
  bodyParams?: Record<string, string | number> | null;
  /** 覆盖默认 appkey（用于特定接口）。 */
  appKey?: string;
  /** 覆盖默认 appSecret（用于特定接口）。 */
  appSecret?: string;
  /** 是否自动添加 MD5 签名，默认 `true`。 */
  needSign?: boolean;
  /** 额外请求头（会合并到默认头上）。 */
  extraHeaders?: Record<string, string>;
  /** HTTP 代理地址（如 `http://127.0.0.1:7890`）。 */
  proxy?: string;
}

// ---------------------------------------------------------------------------
// 核心函数
// ---------------------------------------------------------------------------

/**
 * 发送一个经过 MD5 签名的 B站 API 请求。
 *
 * @typeParam T - 响应 JSON 的类型。
 * @param options - 请求选项。
 * @returns 解析后的 JSON 响应体。
 *
 * @example
 * ```ts
 * const res = await fetchRequest<BiliApiResponse<UserInfo>>({
 *   url: 'https://api.bilibili.com/x/space/myinfo',
 *   method: 'GET',
 *   extraHeaders: { Cookie: `SESSDATA=${creds.SESSDATA}` },
 *   needSign: false,
 * });
 * ```
 */
export async function fetchRequest<T = unknown>(options: FetchRequestOptions): Promise<T> {
  const {
    url,
    method = 'GET',
    params = {},
    bodyParams = null,
    appKey = DEFAULT_APP_KEY,
    appSecret = DEFAULT_APP_SECRET,
    needSign = true,
    extraHeaders = {},
    proxy,
  } = options;

  // 构造最终查询参数
  const finalParams: Record<string, string | number> = { ...params };
  if (needSign) {
    finalParams.appkey = appKey;
    finalParams.sign = signParams(finalParams, appSecret);
  }

  const headers = { ...DEFAULT_HEADERS, ...extraHeaders };

  // 代理
  let httpsAgent: HttpsProxyAgent<string> | undefined;
  if (proxy) {
    httpsAgent = new HttpsProxyAgent(proxy);
  }

  const config: AxiosRequestConfig = {
    url,
    method,
    headers,
    httpsAgent,
    timeout: 15_000,
  };

  if (method === 'GET') {
    config.params = finalParams;
  } else {
    // POST：body 优先使用 bodyParams，否则用 finalParams
    config.params = finalParams;
    config.data = new URLSearchParams(
      Object.fromEntries(
        Object.entries(bodyParams ?? finalParams).map(([k, v]) => [k, String(v)])
      )
    ).toString();
  }

  const response = await axios(config);
  return response.data as T;
}

// ---------------------------------------------------------------------------
// Web 端请求头构建
// ---------------------------------------------------------------------------

/**
 * 构造 B站 Web 端通用请求头（Cookie 形式鉴权）。
 *
 * @param creds - 用户凭据。
 * @returns 请求头对象。
 */
export function buildWebHeaders(creds: {
  SESSDATA: string;
  csrf: string;
  DedeUserID: string;
  access_token?: string;
}): Record<string, string> {
  return {
    Cookie: `SESSDATA=${creds.SESSDATA}; bili_jct=${creds.csrf}; DedeUserID=${creds.DedeUserID}`,
    Referer: 'https://www.bilibili.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
}

/**
 * @packageDocumentation
 * B站直播间相关 API 封装。
 *
 * 功能：
 * - 发送直播间弹幕
 * - 获取直播间信息（房间号、直播状态等）
 * - 直播间点赞
 * - 获取历史弹幕
 * - 获取直播推流密钥（主播用）
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

// ---------------------------------------------------------------------------
// 接口地址
// ---------------------------------------------------------------------------

const SEND_DANMU_URL = 'https://api.live.bilibili.com/xlive/app-room/v1/dM/sendmsg';
const GET_ROOM_INFO_URL = 'https://api.live.bilibili.com/xlive/app-room/v1/index/getInfoByRoom';
const LIKE_ROOM_URL = 'https://api.live.bilibili.com/xlive/app-ucenter/v1/like_info_v3/like/likeReportV3';
const GET_DANMU_HISTORY_URL = 'https://api.live.bilibili.com/xlive/app-room/v1/dM/gethistory';
const GET_LIVE_INFO_URL = 'https://api.bilibili.com/x/space/wbi/acc/info';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 直播间基本信息。 */
export interface LiveRoomInfo {
  /** 直播间 ID（短号）。 */
  room_id: number;
  /** 直播间真实 ID。 */
  uid: number;
  /** 直播状态：0=未开播 1=直播中 2=轮播中。 */
  live_status: number;
  /** 直播间标题。 */
  title: string;
  /** 直播间封面 URL。 */
  cover: string;
  /** 在线人数。 */
  online: number;
  /** 开播时间（Unix 时间戳）。 */
  live_time: number;
}

/** 弹幕历史记录条目。 */
export interface DanmuRecord {
  /** 发送者 UID。 */
  uid: number;
  /** 发送者昵称。 */
  nickname: string;
  /** 弹幕内容。 */
  text: string;
  /** 发送时间戳。 */
  timeline: string;
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 向指定直播间发送弹幕。
 *
 * @param creds - 用户凭据。
 * @param roomId - 直播间房间号（短号或真实 ID 均可）。
 * @param message - 弹幕内容（最多 30 字）。
 * @param options - 可选参数。
 * @param options.color - 弹幕颜色（十进制，默认白色 `16777215`）。
 * @param options.fontsize - 字体大小（默认 `25`）。
 * @param options.mode - 弹幕类型（1=滚动 4=底部 5=顶部，默认 `1`）.
 * @param options.proxy - HTTP 代理地址。
 * @returns B站 API 通用响应。
 *
 * @example
 * ```ts
 * await sendDanmu(creds, 123456, '666666');
 * ```
 */
export async function sendDanmu(
  creds: BiliCredentials,
  roomId: number,
  message: string,
  options: {
    color?: number;
    fontsize?: number;
    mode?: number;
    proxy?: string;
  } = {}
): Promise<BiliApiResponse<unknown>> {
  const params = {
    access_key: creds.access_token,
    actionKey: 'appkey',
    appkey: '1d8b6e7d45233436',
    build: '8020300',
    c_locale: 'zh_CN',
    channel: 'yingyongbao',
    device: 'android',
    disable_rcmd: 0,
    mobi_app: 'android',
    platform: 'android',
    s_locale: 'zh_CN',
    statistics: JSON.stringify({ appId: 1, platform: 3, version: '8.2.0', abtest: '' }),
    ts: Math.floor(Date.now() / 1000),
  };
  const bodyParams = {
    roomid: roomId,
    msg: message,
    color: options.color ?? 16777215,
    fontsize: options.fontsize ?? 25,
    mode: options.mode ?? 1,
    rnd: Math.floor(Date.now() / 1000),
    csrf: creds.csrf,
  };
  return fetchRequest<BiliApiResponse<unknown>>({
    url: SEND_DANMU_URL,
    method: 'POST',
    params: params as unknown as Record<string, string | number>,
    bodyParams: bodyParams as unknown as Record<string, string | number>,
    proxy: options.proxy,
  });
}

/**
 * 获取直播间详细信息。
 *
 * @param creds - 用户凭据。
 * @param roomId - 直播间房间号。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 直播间信息响应。
 */
export async function getRoomInfo(
  creds: BiliCredentials,
  roomId: number,
  proxy?: string
): Promise<BiliApiResponse<{ room_info: LiveRoomInfo }>> {
  const params = {
    access_key: creds.access_token,
    actionKey: 'appkey',
    appkey: '1d8b6e7d45233436',
    build: '8020300',
    c_locale: 'zh_CN',
    channel: 'yingyongbao',
    device: 'android',
    disable_rcmd: 0,
    mobi_app: 'android',
    platform: 'android',
    room_id: roomId,
    s_locale: 'zh_CN',
    statistics: JSON.stringify({ appId: 1, platform: 3, version: '8.2.0', abtest: '' }),
    ts: Math.floor(Date.now() / 1000),
  };
  return fetchRequest<BiliApiResponse<{ room_info: LiveRoomInfo }>>(
    {
      url: GET_ROOM_INFO_URL,
      method: 'GET',
      params: params as unknown as Record<string, string | number>,
      proxy,
    }
  );
}

/**
 * 给直播间点赞（支持批量连击）。
 *
 * @param creds - 用户凭据。
 * @param roomId - 直播间房间号。
 * @param clickCount - 点赞次数（默认 1，最大单次 100）。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns B站 API 通用响应。
 */
export async function likeLiveRoom(
  creds: BiliCredentials,
  roomId: number,
  clickCount = 1,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  const params = {
    access_key: creds.access_token,
    actionKey: 'appkey',
    appkey: '1d8b6e7d45233436',
    build: '8020300',
    c_locale: 'zh_CN',
    channel: 'yingyongbao',
    device: 'android',
    disable_rcmd: 0,
    mobi_app: 'android',
    platform: 'android',
    s_locale: 'zh_CN',
    statistics: JSON.stringify({ appId: 1, platform: 3, version: '8.2.0', abtest: '' }),
    ts: Math.floor(Date.now() / 1000),
  };
  const bodyParams = {
    click_time: Math.min(clickCount, 100),
    room_id: roomId,
    csrf: creds.csrf,
    csrf_token: creds.csrf,
  };
  return fetchRequest<BiliApiResponse<unknown>>({
    url: LIKE_ROOM_URL,
    method: 'POST',
    params: params as unknown as Record<string, string | number>,
    bodyParams: bodyParams as unknown as Record<string, string | number>,
    proxy,
  });
}

/**
 * 获取直播间历史弹幕。
 *
 * @param creds - 用户凭据。
 * @param roomId - 直播间房间号。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 弹幕历史列表响应。
 */
export async function getDanmuHistory(
  creds: BiliCredentials,
  roomId: number,
  proxy?: string
): Promise<BiliApiResponse<{ room: DanmuRecord[] }>> {
  const params = {
    access_key: creds.access_token,
    actionKey: 'appkey',
    appkey: '1d8b6e7d45233436',
    build: '8020300',
    c_locale: 'zh_CN',
    channel: 'yingyongbao',
    device: 'android',
    mobi_app: 'android',
    platform: 'android',
    room_id: roomId,
    s_locale: 'zh_CN',
    ts: Math.floor(Date.now() / 1000),
  };
  return fetchRequest<BiliApiResponse<{ room: DanmuRecord[] }>>(
    {
      url: GET_DANMU_HISTORY_URL,
      method: 'GET',
      params: params as unknown as Record<string, string | number>,
      proxy,
    }
  );
}

/**
 * 获取指定用户的直播间信息（通过 UID 查询）。
 *
 * @param uid - 目标用户 UID。
 * @param creds - 用户凭据（可选，不提供时以游客身份请求）。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 用户直播间信息响应。
 */
export async function getUserLiveInfo(
  uid: number,
  creds?: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<{ live_room?: LiveRoomInfo }>> {
  const extraHeaders = creds ? buildWebHeaders(creds) : {};
  return fetchRequest<BiliApiResponse<{ live_room?: LiveRoomInfo }>>(
    {
      url: GET_LIVE_INFO_URL,
      method: 'GET',
      params: { mid: uid },
      needSign: false,
      extraHeaders,
      proxy,
    }
  );
}

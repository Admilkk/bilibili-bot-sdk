/**
 * @packageDocumentation
 * B站视频相关 API 封装。
 *
 * 功能：
 * - 获取视频信息（标题、封面、cid 等）
 * - 获取视频流地址（playurl，支持 DASH / FLV）
 * - 搜索视频
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

// ---------------------------------------------------------------------------
// 接口地址
// ---------------------------------------------------------------------------

const VIDEO_VIEW_URL = 'https://api.bilibili.com/x/web-interface/view';
const VIDEO_PLAYURL_URL = 'https://api.bilibili.com/x/player/playurl';
const VIDEO_SEARCH_URL = 'https://app.bilibili.com/x/v2/search/type';
const VIDEO_DETAIL_URL = 'https://app.bilibili.com/x/v2/view';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 视频基本信息。 */
export interface VideoInfo {
  /** AV 号。 */
  aid: number;
  /** BV 号。 */
  bvid: string;
  /** 分 P cid。 */
  cid: number;
  /** 标题。 */
  title: string;
  /** 封面 URL。 */
  pic: string;
  /** 简介。 */
  desc: string;
  /** UP 主 UID。 */
  mid: number;
  /** UP 主昵称。 */
  owner: { mid: number; name: string; face: string };
  /** 播放数等统计。 */
  stat: {
    view: number;
    danmaku: number;
    reply: number;
    favorite: number;
    coin: number;
    share: number;
    like: number;
  };
  /** 时长（秒）。 */
  duration: number;
  /** 分区名。 */
  tname: string;
}

/** playurl DASH 流信息。 */
export interface DashStream {
  id: number;
  baseUrl: string;
  base_url: string;
  backupUrl: string[];
  bandwidth: number;
  mimeType: string;
  codecs: string;
  width?: number;
  height?: number;
  frameRate?: string;
}

/** playurl 响应数据。 */
export interface PlayUrlData {
  quality: number;
  format: string;
  timelength: number;
  accept_format: string;
  accept_description: string[];
  accept_quality: number[];
  dash?: {
    video: DashStream[];
    audio: DashStream[];
  };
  durl?: Array<{
    order: number;
    length: number;
    size: number;
    url: string;
    backup_url: string[];
  }>;
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 通过 bvid 或 aid 获取视频基本信息。
 *
 * @param idOrBvid - BV 号（字符串）或 AV 号（数字）。
 * @param creds - 用户凭据（可选，未登录时无法获取部分信息）。
 * @param proxy - 可选代理地址。
 */
export async function getVideoInfo(
  idOrBvid: string | number,
  creds?: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<VideoInfo>> {
  const params: Record<string, string | number> = typeof idOrBvid === 'string'
    ? { bvid: idOrBvid }
    : { aid: idOrBvid };
  const extraHeaders = creds ? buildWebHeaders(creds) : {};
  return fetchRequest<BiliApiResponse<VideoInfo>>({
    url: VIDEO_VIEW_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders,
    proxy,
  });
}

/**
 * 获取视频详情（Android App 接口，含更多字段）。
 *
 * @param aid - AV 号。
 * @param creds - 用户凭据。
 * @param proxy - 可选代理地址。
 */
export async function getVideoDetail(
  aid: number,
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: VIDEO_DETAIL_URL,
    method: 'GET',
    params: {
      access_key: creds.access_token,
      aid,
      build: '8020300',
      c_locale: 'zh_CN',
      channel: 'yingyongbao',
      device: 'android',
      mobi_app: 'android',
      platform: 'android',
      s_locale: 'zh_CN',
      statistics: JSON.stringify({ appId: 1, platform: 3, version: '8.2.0', abtest: '' }),
      ts: Math.floor(Date.now() / 1000),
    },
    proxy,
  });
}

/**
 * 获取视频流地址（Web 接口，支持 DASH 和 FLV）。
 *
 * @param creds - 用户凭据（需要登录才能获取高清流）。
 * @param aid - AV 号。
 * @param cid - 分 P cid（通过 getVideoInfo 获取）。
 * @param options - 可选参数。
 * @param options.qn - 画质代码（默认 80=1080P，其他：64=720P 32=480P 16=360P）。
 * @param options.fnval - 视频格式（默认 16=DASH，1=FLV）。
 * @param options.fourk - 是否请求 4K（默认 false）。
 * @param options.proxy - 可选代理地址。
 *
 * @example
 * ```ts
 * const info = await getVideoInfo('BV1dM411w79B', creds);
 * const { aid, cid } = info.data;
 * const play = await getPlayUrl(creds, aid, cid, { qn: 80, fnval: 16 });
 * const videoUrl = play.data.dash.video[0].baseUrl;
 * ```
 */
export async function getPlayUrl(
  creds: BiliCredentials,
  aid: number,
  cid: number,
  options: {
    qn?: number;
    fnval?: number;
    fourk?: boolean;
    proxy?: string;
  } = {}
): Promise<BiliApiResponse<PlayUrlData>> {
  return fetchRequest<BiliApiResponse<PlayUrlData>>({
    url: VIDEO_PLAYURL_URL,
    method: 'GET',
    params: {
      access_key: creds.access_token,
      avid: aid,
      cid,
      qn: options.qn ?? 80,
      fnval: options.fnval ?? 16,
      fnver: 0,
      fourk: options.fourk ? 1 : 0,
      build: '8020300',
      mobi_app: 'android',
      platform: 'android',
      ts: Math.floor(Date.now() / 1000),
    },
    proxy: options.proxy,
  });
}

/**
 * 搜索视频（Android App 接口）。
 *
 * @param creds - 用户凭据。
 * @param keyword - 搜索关键词。
 * @param options - 可选参数。
 * @param options.page - 页码（默认 1）。
 * @param options.pageSize - 每页数量（默认 20）。
 * @param options.proxy - 可选代理地址。
 */
export async function searchVideo(
  creds: BiliCredentials,
  keyword: string,
  options: {
    page?: number;
    pageSize?: number;
    proxy?: string;
  } = {}
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: VIDEO_SEARCH_URL,
    method: 'GET',
    params: {
      access_key: creds.access_token,
      build: '8020300',
      c_locale: 'zh_CN',
      channel: 'yingyongbao',
      device: 'android',
      keyword,
      mobi_app: 'android',
      page: options.page ?? 1,
      pagesize: options.pageSize ?? 20,
      platform: 'android',
      s_locale: 'zh_CN',
      search_type: 'video',
      statistics: JSON.stringify({ appId: 1, platform: 3, version: '8.2.0', abtest: '' }),
      ts: Math.floor(Date.now() / 1000),
    },
    proxy: options.proxy,
  });
}

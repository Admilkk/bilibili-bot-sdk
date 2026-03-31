/**
 * @packageDocumentation
 * B站搜索相关 API 封装。
 *
 * 功能：
 * - 综合搜索
 * - 分类搜索（视频/用户/番剧等）
 * - 获取热搜词
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import { signWbi } from './crypto.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

const SEARCH_ALL_URL = 'https://api.bilibili.com/x/web-interface/wbi/search/all/v2';
const SEARCH_TYPE_URL = 'https://api.bilibili.com/x/web-interface/wbi/search/type';
const HOT_SEARCH_URL = 'https://api.bilibili.com/x/web-interface/search/default';

/**
 * 搜索类型。
 *
 * - `video` — 视频
 * - `bili_user` — 用户
 * - `media_bangumi` — 番剧
 * - `media_ft` — 影视
 * - `live_room` — 直播间
 * - `live_user` — 直播用户
 * - `article` — 专栏
 * - `topic` — 话题
 */
export type SearchType =
  | 'video'
  | 'bili_user'
  | 'media_bangumi'
  | 'media_ft'
  | 'live_room'
  | 'live_user'
  | 'article'
  | 'topic';

/** 分类搜索选项。 */
export interface SearchTypeOptions {
  /** 排序方式：totalrank/click/pubdate/dm/stow/scores。 */
  order?: string;
  /** 时长筛选（仅视频）：0=全部 1=<10分 2=10-30分 3=30-60分 4=>60分。 */
  duration?: 0 | 1 | 2 | 3 | 4;
  /** 分区 tid（仅视频）。 */
  tids?: number;
  /** 用户类型（仅用户）：0=全部 1=UP主 2=普通用户 3=认证用户。 */
  user_type?: 0 | 1 | 2 | 3;
  /** 页码（默认 1）。 */
  page?: number;
}

/**
 * 综合搜索。
 *
 * @param keyword - 搜索关键词。
 * @param creds - 用户凭据。
 * @param proxy - 可选代理。
 */
export async function searchAll(
  keyword: string,
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  const params = await signWbi({ keyword }, creds);
  return fetchRequest({
    url: SEARCH_ALL_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 分类搜索。
 *
 * @param keyword - 搜索关键词。
 * @param searchType - 搜索类型。
 * @param options - 筛选选项。
 * @param creds - 用户凭据。
 * @param proxy - 可选代理。
 */
export async function searchByType(
  keyword: string,
  searchType: SearchType,
  options: SearchTypeOptions = {},
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  const raw: Record<string, string | number> = {
    keyword,
    search_type: searchType,
    page: options.page ?? 1,
  };
  if (options.order) raw.order = options.order;
  if (options.duration !== undefined) raw.duration = options.duration;
  if (options.tids !== undefined) raw.tids = options.tids;
  if (options.user_type !== undefined) raw.user_type = options.user_type;
  const params = await signWbi(raw, creds);
  return fetchRequest({
    url: SEARCH_TYPE_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 获取热搜词。
 *
 * @param proxy - 可选代理。
 */
export async function getHotSearch(proxy?: string): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: HOT_SEARCH_URL,
    method: 'GET',
    params: {},
    needSign: false,
    proxy,
  });
}

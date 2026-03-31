/**
 * @packageDocumentation
 * B站历史记录与稍后再看 API 封装。
 *
 * 功能：
 * - 获取历史记录
 * - 删除历史记录
 * - 清空历史记录
 * - 获取稍后再看列表
 * - 添加稍后再看
 * - 删除稍后再看
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

const GET_HISTORY_URL = 'https://api.bilibili.com/x/web-interface/history/cursor';
const DELETE_HISTORY_URL = 'https://api.bilibili.com/x/v2/history/delete';
const CLEAR_HISTORY_URL = 'https://api.bilibili.com/x/v2/history/clear';
const GET_TOVIEW_URL = 'https://api.bilibili.com/x/v2/history/toview';
const ADD_TOVIEW_URL = 'https://api.bilibili.com/x/v2/history/toview/add';
const DELETE_TOVIEW_URL = 'https://api.bilibili.com/x/v2/history/toview/del';

/** 历史记录条目。 */
export interface HistoryItem {
  /** 目标 ID（视频为 aid）。 */
  oid: number;
  /** BV 号（视频类型）。 */
  bvid?: string;
  /** 标题。 */
  title: string;
  /** 封面 URL。 */
  cover: string;
  /** 观看时间戳。 */
  view_at: number;
  /** 观看进度（秒）。 */
  progress: number;
  /** UP 主信息。 */
  author_name: string;
  /** 历史记录业务类型。 */
  business: string;
}

/** 稍后再看条目。 */
export interface ToViewItem {
  /** 视频 aid。 */
  aid: number;
  /** BV 号。 */
  bvid: string;
  /** 标题。 */
  title: string;
  /** 封面 URL。 */
  pic: string;
  /** 添加时间戳。 */
  add_at: number;
  /** UP 主信息。 */
  owner: { mid: number; name: string; face: string };
}

/**
 * 获取历史记录列表。
 *
 * @param creds - 用户凭据。
 * @param options - 查询选项。
 * @param proxy - 可选代理。
 */
export async function getHistory(
  creds: BiliCredentials,
  options: { type?: string; ps?: number; max?: number; view_at?: number } = {},
  proxy?: string
): Promise<BiliApiResponse<{ cursor: { max: number; view_at: number; business: string; ps: number }; tab: unknown[]; list: HistoryItem[] }>> {
  const params: Record<string, string | number> = {
    ps: options.ps ?? 20,
  };
  if (options.type) params.type = options.type;
  if (options.max) params.max = options.max;
  if (options.view_at) params.view_at = options.view_at;
  return fetchRequest({
    url: GET_HISTORY_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 删除一条历史记录。
 *
 * @param creds - 用户凭据。
 * @param kid - 历史记录条目 kid（格式：`{business}_{oid}`，如 `archive_123456`）。
 * @param proxy - 可选代理。
 */
export async function deleteHistory(
  creds: BiliCredentials,
  kid: string,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: DELETE_HISTORY_URL,
    method: 'POST',
    params: {},
    bodyParams: { kid, csrf: creds.csrf },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 清空所有历史记录。
 *
 * @param creds - 用户凭据。
 * @param proxy - 可选代理。
 */
export async function clearHistory(
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: CLEAR_HISTORY_URL,
    method: 'POST',
    params: {},
    bodyParams: { csrf: creds.csrf },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 获取稍后再看列表。
 *
 * @param creds - 用户凭据。
 * @param proxy - 可选代理。
 */
export async function getToView(
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<{ count: number; list: ToViewItem[] }>> {
  return fetchRequest({
    url: GET_TOVIEW_URL,
    method: 'GET',
    params: {},
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 添加视频到稍后再看。
 *
 * @param creds - 用户凭据。
 * @param aid - 视频 AV 号。
 * @param proxy - 可选代理。
 */
export async function addToView(
  creds: BiliCredentials,
  aid: number,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: ADD_TOVIEW_URL,
    method: 'POST',
    params: {},
    bodyParams: { aid, csrf: creds.csrf },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 从稍后再看中删除视频。
 *
 * @param creds - 用户凭据。
 * @param aid - 视频 AV 号（多个用逗号分隔的字符串）。
 * @param proxy - 可选代理。
 */
export async function deleteToView(
  creds: BiliCredentials,
  aid: number | string,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: DELETE_TOVIEW_URL,
    method: 'POST',
    params: {},
    bodyParams: { aid: String(aid), csrf: creds.csrf },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

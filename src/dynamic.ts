/**
 * @packageDocumentation
 * B站动态相关 API 封装。
 *
 * 功能：
 * - 获取关注动态列表
 * - 获取某用户动态列表
 * - 删除动态
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

// ---------------------------------------------------------------------------
// 接口地址
// ---------------------------------------------------------------------------

const GET_DYNAMIC_LIST_URL = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all';
const GET_USER_DYNAMIC_URL = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space';
const DELETE_DYNAMIC_URL = 'https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 动态列表查询选项。 */
export interface DynamicListOptions {
  /** 动态类型筛选：all/video/pgc/article（默认 all）。 */
  type?: 'all' | 'video' | 'pgc' | 'article';
  /** 翻页偏移量（从上次返回的 offset 获取）。 */
  offset?: string;
  /** 查看某用户主页动态时的 UID。 */
  host_mid?: number;
}

/** 动态条目（简化结构）。 */
export interface DynamicItem {
  /** 动态 ID。 */
  id_str: string;
  /** 动态类型。 */
  type: string;
  /** 动态模块数据（原始结构）。 */
  modules: Record<string, unknown>;
  /** 原始转发动态（如有）。 */
  orig?: DynamicItem;
}

// ---------------------------------------------------------------------------
// API 函数
// ---------------------------------------------------------------------------

/**
 * 获取关注用户的动态列表。
 *
 * @param creds - 用户凭据。
 * @param options - 查询选项。
 * @param proxy - 可选代理。
 */
export async function getDynamicList(
  creds: BiliCredentials,
  options: DynamicListOptions = {},
  proxy?: string
): Promise<BiliApiResponse<{ items: DynamicItem[]; offset: string; update_baseline: string; update_num: number }>> {
  const params: Record<string, string | number> = {
    type: options.type ?? 'all',
    platform: 'web',
    features: 'itemOpusStyle',
  };
  if (options.offset) params.offset = options.offset;
  if (options.host_mid) params.host_mid = options.host_mid;
  return fetchRequest({
    url: GET_DYNAMIC_LIST_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 获取某用户的动态列表。
 *
 * @param uid - 目标用户 UID。
 * @param creds - 用户凭据（可选）。
 * @param options - 查询选项。
 * @param proxy - 可选代理。
 */
export async function getUserDynamicList(
  uid: number,
  creds?: BiliCredentials,
  options: { offset?: string } = {},
  proxy?: string
): Promise<BiliApiResponse<{ items: DynamicItem[]; offset: string }>> {
  const params: Record<string, string | number> = {
    host_mid: uid,
    platform: 'web',
    features: 'itemOpusStyle',
  };
  if (options.offset) params.offset = options.offset;
  return fetchRequest({
    url: GET_USER_DYNAMIC_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders: creds ? buildWebHeaders(creds) : {},
    proxy,
  });
}

/**
 * 删除一条动态。
 *
 * @param creds - 用户凭据。
 * @param dynamicId - 动态 ID。
 * @param proxy - 可选代理。
 */
export async function deleteDynamic(
  creds: BiliCredentials,
  dynamicId: string,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: DELETE_DYNAMIC_URL,
    method: 'POST',
    params: {},
    bodyParams: {
      dynamic_id: dynamicId,
      csrf_token: creds.csrf,
      csrf: creds.csrf,
    },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

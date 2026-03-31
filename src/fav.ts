/**
 * @packageDocumentation
 * B站收藏夹相关 API 封装。
 *
 * 功能：
 * - 获取收藏夹元数据
 * - 获取用户所有收藏夹列表
 * - 获取收藏夹内容
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

const GET_FAV_FOLDER_INFO_URL = 'https://api.bilibili.com/x/v3/fav/folder/info';
const GET_FAV_FOLDER_LIST_URL = 'https://api.bilibili.com/x/v3/fav/folder/created/list-all';
const GET_FAV_CONTENT_URL = 'https://api.bilibili.com/x/v3/fav/resource/list';

/** 收藏夹元数据。 */
export interface FavFolderInfo {
  /** 收藏夹完整 ID（mlid）。 */
  id: number;
  /** 收藏夹原始 ID。 */
  fid: number;
  /** 创建者 UID。 */
  mid: number;
  /** 收藏夹标题。 */
  title: string;
  /** 封面图 URL。 */
  cover: string;
  /** 备注。 */
  intro: string;
  /** 内容数量。 */
  media_count: number;
  /** 创建者信息。 */
  upper: { mid: number; name: string; face: string };
}

/** 收藏夹内容条目。 */
export interface FavResource {
  /** 视频 ID（avid）。 */
  id: number;
  /** BV 号。 */
  bvid: string;
  /** 标题。 */
  title: string;
  /** 封面 URL。 */
  cover: string;
  /** UP 主信息。 */
  upper: { mid: number; name: string };
  /** 收藏时间戳。 */
  fav_time: number;
  /** 播放数。 */
  cnt_info: { play: number; danmaku: number; collect: number };
}

/**
 * 获取收藏夹元数据。
 *
 * @param mediaId - 收藏夹完整 ID（mlid）。
 * @param creds - 用户凭据（可选，查看私有收藏夹需要）。
 * @param proxy - 可选代理。
 */
export async function getFavFolderInfo(
  mediaId: number,
  creds?: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<FavFolderInfo>> {
  return fetchRequest({
    url: GET_FAV_FOLDER_INFO_URL,
    method: 'GET',
    params: { media_id: mediaId },
    needSign: false,
    extraHeaders: creds ? buildWebHeaders(creds) : {},
    proxy,
  });
}

/**
 * 获取用户创建的所有收藏夹列表。
 *
 * @param uid - 目标用户 UID。
 * @param creds - 用户凭据（可选）。
 * @param proxy - 可选代理。
 */
export async function getFavFolderList(
  uid: number,
  creds?: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<{ list: FavFolderInfo[] }>> {
  return fetchRequest({
    url: GET_FAV_FOLDER_LIST_URL,
    method: 'GET',
    params: { up_mid: uid },
    needSign: false,
    extraHeaders: creds ? buildWebHeaders(creds) : {},
    proxy,
  });
}

/**
 * 获取收藏夹内容列表。
 *
 * @param mediaId - 收藏夹完整 ID（mlid）。
 * @param options - 查询选项。
 * @param creds - 用户凭据（可选）。
 * @param proxy - 可选代理。
 */
export async function getFavFolderContent(
  mediaId: number,
  options: { pn?: number; ps?: number; keyword?: string } = {},
  creds?: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<{ medias: FavResource[]; has_more: boolean }>> {
  const params: Record<string, string | number> = {
    media_id: mediaId,
    pn: options.pn ?? 1,
    ps: options.ps ?? 20,
    type: 0,
    tid: 0,
    order: 'mtime',
  };
  if (options.keyword) params.keyword = options.keyword;
  return fetchRequest({
    url: GET_FAV_CONTENT_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders: creds ? buildWebHeaders(creds) : {},
    proxy,
  });
}

/**
 * @packageDocumentation
 * B站评论区相关 API 封装。
 *
 * 功能：
 * - 获取评论列表
 * - 发送评论
 * - 点赞评论
 * - 删除评论
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

// ---------------------------------------------------------------------------
// 接口地址
// ---------------------------------------------------------------------------

const GET_COMMENTS_URL = 'https://api.bilibili.com/x/v2/reply';
const SEND_COMMENT_URL = 'https://api.bilibili.com/x/v2/reply/add';
const LIKE_COMMENT_URL = 'https://api.bilibili.com/x/v2/reply/action';
const DELETE_COMMENT_URL = 'https://api.bilibili.com/x/v2/reply/del';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/**
 * 评论区类型代码。
 *
 * 常用值：1=视频 11=话题 12=专栏 17=动态。
 */
export type CommentType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 17 | 22;

/** 评论条目。 */
export interface CommentItem {
  /** 评论 ID（rpid）。 */
  rpid: number;
  /** 发送者 UID。 */
  mid: number;
  /** 评论内容。 */
  content: { message: string; members: unknown[] };
  /** 点赞数。 */
  like: number;
  /** 发送时间戳。 */
  ctime: number;
  /** 子评论数。 */
  rcount: number;
  /** 子评论列表（前3条）。 */
  replies: CommentItem[] | null;
}

// ---------------------------------------------------------------------------
// API 函数
// ---------------------------------------------------------------------------

/**
 * 获取评论列表。
 *
 * @param oid - 目标评论区 ID（视频为 aid）。
 * @param type - 评论区类型代码（视频=1）。
 * @param options - 查询选项。
 * @param creds - 用户凭据（可选）。
 * @param proxy - 可选代理。
 */
export async function getComments(
  oid: number,
  type: CommentType,
  options: { sort?: 0 | 1 | 2; pn?: number; ps?: number } = {},
  creds?: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<{ replies: CommentItem[]; page: { count: number; num: number; size: number } }>> {
  return fetchRequest({
    url: GET_COMMENTS_URL,
    method: 'GET',
    params: {
      type,
      oid,
      sort: options.sort ?? 0,
      pn: options.pn ?? 1,
      ps: options.ps ?? 20,
    },
    needSign: false,
    extraHeaders: creds ? buildWebHeaders(creds) : {},
    proxy,
  });
}

/**
 * 发送评论。
 *
 * @param creds - 用户凭据。
 * @param oid - 目标评论区 ID。
 * @param type - 评论区类型代码。
 * @param message - 评论内容。
 * @param options - 回复选项（root/parent 用于回复楼中楼）。
 * @param proxy - 可选代理。
 */
export async function sendComment(
  creds: BiliCredentials,
  oid: number,
  type: CommentType,
  message: string,
  options: { root?: number; parent?: number } = {},
  proxy?: string
): Promise<BiliApiResponse<{ rpid: number; rpid_str: string }>> {
  const body: Record<string, string | number> = {
    type,
    oid,
    message,
    csrf: creds.csrf,
  };
  if (options.root) body.root = options.root;
  if (options.parent) body.parent = options.parent;
  return fetchRequest({
    url: SEND_COMMENT_URL,
    method: 'POST',
    params: {},
    bodyParams: body,
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 点赞或取消点赞评论。
 *
 * @param creds - 用户凭据。
 * @param oid - 目标评论区 ID。
 * @param type - 评论区类型代码。
 * @param rpid - 目标评论 ID。
 * @param action - 操作：1=点赞 0=取消（默认 1）。
 * @param proxy - 可选代理。
 */
export async function likeComment(
  creds: BiliCredentials,
  oid: number,
  type: CommentType,
  rpid: number,
  action: 0 | 1 = 1,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: LIKE_COMMENT_URL,
    method: 'POST',
    params: {},
    bodyParams: { type, oid, rpid, action, csrf: creds.csrf },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 删除评论。
 *
 * @param creds - 用户凭据。
 * @param oid - 目标评论区 ID。
 * @param type - 评论区类型代码。
 * @param rpid - 目标评论 ID。
 * @param proxy - 可选代理。
 */
export async function deleteComment(
  creds: BiliCredentials,
  oid: number,
  type: CommentType,
  rpid: number,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest({
    url: DELETE_COMMENT_URL,
    method: 'POST',
    params: {},
    bodyParams: { type, oid, rpid, csrf: creds.csrf },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * @packageDocumentation
 * B站用户信息相关 API 封装。
 *
 * 功能：
 * - 获取用户详细信息
 * - 获取粉丝列表
 * - 获取关注列表
 * - 查询与某用户的关系
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import { signWbi } from './crypto.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

// ---------------------------------------------------------------------------
// 接口地址
// ---------------------------------------------------------------------------

const GET_USER_INFO_URL = 'https://api.bilibili.com/x/space/wbi/acc/info';
const GET_FOLLOWERS_URL = 'https://api.bilibili.com/x/relation/followers';
const GET_FOLLOWINGS_URL = 'https://api.bilibili.com/x/relation/followings';
const GET_RELATION_URL = 'https://api.bilibili.com/x/relation';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 用户详细信息。 */
export interface UserInfo {
  /** 用户 UID。 */
  mid: number;
  /** 昵称。 */
  name: string;
  /** 性别：男/女/保密。 */
  sex: string;
  /** 头像 URL。 */
  face: string;
  /** 个人签名。 */
  sign: string;
  /** 当前等级（0-6）。 */
  level: number;
  /** 是否已关注此用户。 */
  is_followed: boolean;
  /** 直播间信息。 */
  live_room?: Record<string, unknown>;
  /** 大会员信息。 */
  vip?: Record<string, unknown>;
}

/** 关注/粉丝列表条目。 */
export interface RelationUser {
  /** 用户 UID。 */
  mid: number;
  /** 昵称。 */
  uname: string;
  /** 头像 URL。 */
  face: string;
  /** 个人签名。 */
  sign: string;
  /** 大会员类型。 */
  vip_type: number;
}

/** 与某用户的关系信息。 */
export interface UserRelation {
  /** 关注属性：0=未关注 1=已关注 2=悄悄关注 6=已拉黑 128=被拉黑。 */
  attribute: number;
  /** 对方对我的关注属性。 */
  be_attribute: number;
  /** 关注时间戳（秒）。 */
  mtime: number;
}

// ---------------------------------------------------------------------------
// API 函数
// ---------------------------------------------------------------------------

/**
 * 获取用户详细信息。
 *
 * @param uid - 目标用户 UID。
 * @param creds - 用户凭据（可选，未登录时部分字段不可见）。
 * @param proxy - 可选代理。
 */
export async function getUserInfo(
  uid: number,
  creds?: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<UserInfo>> {
  const rawParams: Record<string, string | number> = { mid: uid };
  let params: Record<string, string | number>;
  let extraHeaders: Record<string, string> = {};
  if (creds) {
    params = await signWbi(rawParams, creds);
    extraHeaders = buildWebHeaders(creds);
  } else {
    params = rawParams;
  }
  return fetchRequest<BiliApiResponse<UserInfo>>({
    url: GET_USER_INFO_URL,
    method: 'GET',
    params,
    needSign: false,
    extraHeaders,
    proxy,
  });
}

/**
 * 获取用户粉丝列表。
 *
 * @param vmid - 目标用户 UID。
 * @param pn - 页码（默认 1）。
 * @param ps - 每页数量（默认 20，最大 200）。
 * @param creds - 用户凭据。
 * @param proxy - 可选代理。
 */
export async function getFollowers(
  vmid: number,
  pn = 1,
  ps = 20,
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<{ list: RelationUser[]; total: number }>> {
  return fetchRequest({
    url: GET_FOLLOWERS_URL,
    method: 'GET',
    params: { vmid, pn, ps },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 获取用户关注列表。
 *
 * @param vmid - 目标用户 UID。
 * @param pn - 页码（默认 1）。
 * @param ps - 每页数量（默认 20，最大 200）。
 * @param creds - 用户凭据。
 * @param proxy - 可选代理。
 */
export async function getFollowings(
  vmid: number,
  pn = 1,
  ps = 20,
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<{ list: RelationUser[]; total: number }>> {
  return fetchRequest({
    url: GET_FOLLOWINGS_URL,
    method: 'GET',
    params: { vmid, pn, ps },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 查询与某用户的关系。
 *
 * @param mid - 目标用户 UID。
 * @param creds - 用户凭据。
 * @param proxy - 可选代理。
 */
export async function getUserRelation(
  mid: number,
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<UserRelation>> {
  return fetchRequest({
    url: GET_RELATION_URL,
    method: 'GET',
    params: { fid: mid },
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

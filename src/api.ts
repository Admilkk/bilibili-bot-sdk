/**
 * @packageDocumentation
 * B站通用 REST API 封装（对应原 BAPI.js）。
 *
 * 功能：
 * - 获取用户信息（myinfo / space）
 * - 视频操作（点赞、投币、一键三连、分享）
 * - 关注 / 取消关注
 * - 漫画签到
 * - 大会员积分领取
 * - Token 刷新（同 auth.ts 保持一致，此处提供低层直接调用）
 */

import { fetchRequest, buildWebHeaders } from './http.js';
import type { BiliApiResponse, BiliCredentials } from './types.js';

// ---------------------------------------------------------------------------
// 接口地址
// ---------------------------------------------------------------------------

const URLS = {
  myinfo: 'https://api.bilibili.com/x/space/myinfo',
  myinfo2: 'https://app.bilibili.com/x/v2/account/myinfo',
  userinfo: 'https://app.bilibili.com/x/v2/account/info',
  space: 'https://app.bilibili.com/x/v2/space',
  like: 'https://app.bilibili.com/x/v2/view/like',
  dislike: 'https://app.bilibili.com/x/v2/view/dislike',
  triple: 'https://app.bilibili.com/x/v2/view/like/triple',
  coin: 'https://app.bilibili.com/x/v2/view/coin/add',
  share: 'https://api.bilibili.com/x/share/finish',
  relation: 'https://api.bilibili.com/x/relation/modify',
  mangaSign: 'https://manga.bilibili.com/twirp/activity.v1.Activity/ClockIn',
  mangaShare: 'https://manga.bilibili.com/twirp/activity.v1.Activity/ShareComic',
  vipExperience: 'https://api.bilibili.com/x/vip/experience/add',
  vipPrivilege: 'https://api.bilibili.com/x/vip/privilege/receive',
  expLog: 'https://api.bilibili.com/x/member/web/exp/log',
  expReward: 'https://api.bilibili.com/x/member/web/exp/reward',
};

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/** 构造 Android App 通用参数。 */
function appBaseParams(creds: BiliCredentials): Record<string, string | number> {
  return {
    access_key: creds.access_token,
    build: '8020300',
    buvid: 'XU4C85241BF18FBC9C5C20CA1D08F38937711',
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
}

// ---------------------------------------------------------------------------
// 用户信息
// ---------------------------------------------------------------------------

/**
 * 获取当前登录账号的个人资料（Web 接口）。
 *
 * @param creds - 用户凭据。
 * @param proxy - 可选代理地址。
 */
export async function getMyInfo(
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.myinfo,
    method: 'GET',
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

/**
 * 获取当前登录账号的个人资料（Android App 接口）。
 *
 * @param creds - 用户凭据。
 * @param proxy - 可选代理地址。
 */
export async function getMyInfo2(
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.myinfo2,
    method: 'GET',
    params: appBaseParams(creds),
    proxy,
  });
}

/**
 * 获取任意用户的空间信息。
 *
 * @param creds - 用户凭据。
 * @param mid - 目标用户 UID。
 * @param proxy - 可选代理地址。
 */
export async function getSpace(
  creds: BiliCredentials,
  mid: number,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.space,
    method: 'GET',
    params: { ...appBaseParams(creds), vmid: mid },
    proxy,
  });
}

// ---------------------------------------------------------------------------
// 视频操作
// ---------------------------------------------------------------------------

/**
 * 对视频点赞或取消点赞。
 *
 * @param creds - 用户凭据。
 * @param aid - 视频 AV 号。
 * @param like - `true` 点赞，`false` 取消点赞。
 * @param proxy - 可选代理地址。
 */
export async function likeVideo(
  creds: BiliCredentials,
  aid: number,
  like: boolean,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: like ? URLS.like : URLS.dislike,
    method: 'POST',
    params: appBaseParams(creds),
    bodyParams: { aid, like: like ? 1 : 0, ...appBaseParams(creds) },
    proxy,
  });
}

/**
 * 给视频投币。
 *
 * @param creds - 用户凭据。
 * @param aid - 视频 AV 号。
 * @param multiply - 投币数量（1 或 2）。
 * @param proxy - 可选代理地址。
 */
export async function addCoin(
  creds: BiliCredentials,
  aid: number,
  multiply: 1 | 2 = 1,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.coin,
    method: 'POST',
    params: appBaseParams(creds),
    bodyParams: { aid, multiply, ...appBaseParams(creds) },
    proxy,
  });
}

/**
 * 一键三连（点赞+投币+收藏）。
 *
 * @param creds - 用户凭据。
 * @param aid - 视频 AV 号。
 * @param proxy - 可选代理地址。
 */
export async function tripleVideo(
  creds: BiliCredentials,
  aid: number,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.triple,
    method: 'POST',
    params: appBaseParams(creds),
    bodyParams: { aid, ...appBaseParams(creds) },
    proxy,
  });
}

/**
 * 分享视频（上报分享行为，获取分享经验）。
 *
 * @param creds - 用户凭据。
 * @param aid - 视频 AV 号。
 * @param proxy - 可选代理地址。
 */
export async function shareVideo(
  creds: BiliCredentials,
  aid: number,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.share,
    method: 'POST',
    params: appBaseParams(creds),
    bodyParams: { aid, ...appBaseParams(creds) },
    proxy,
  });
}

// ---------------------------------------------------------------------------
// 社交关系
// ---------------------------------------------------------------------------

/**
 * 修改与用户的关注关系。
 *
 * @param creds - 用户凭据。
 * @param fid - 目标用户 UID。
 * @param action - 操作类型：
 *   - `1` 关注
 *   - `2` 取消关注
 *   - `3` 悄悄关注
 *   - `5` 拉黑
 *   - `6` 取消拉黑
 *   - `7` 踢出粉丝团
 * @param proxy - 可选代理地址。
 */
export async function modifyRelation(
  creds: BiliCredentials,
  fid: number,
  action: 1 | 2 | 3 | 5 | 6 | 7,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.relation,
    method: 'POST',
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    bodyParams: {
      fid,
      act: action,
      re_src: 11,
      csrf: creds.csrf,
    },
    proxy,
  });
}

// ---------------------------------------------------------------------------
// 漫画签到 / 分享
// ---------------------------------------------------------------------------

/**
 * 漫画 App 每日签到。
 *
 * @param creds - 用户凭据。
 * @param proxy - 可选代理地址。
 */
export async function signManga(
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.mangaSign,
    method: 'POST',
    needSign: false,
    extraHeaders: {
      ...buildWebHeaders(creds),
      'Content-Type': 'application/json',
    },
    bodyParams: { platform: 'android' },
    proxy,
  });
}

// ---------------------------------------------------------------------------
// 大会员
// ---------------------------------------------------------------------------

/**
 * 大会员每日观看经验上报。
 *
 * @param creds - 用户凭据。
 * @param proxy - 可选代理地址。
 */
export async function addVipExperience(
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.vipExperience,
    method: 'POST',
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    bodyParams: { csrf: creds.csrf },
    proxy,
  });
}

/**
 * 领取大会员每月权益。
 *
 * @param creds - 用户凭据。
 * @param type - 权益类型（通常为 1 或 2）。
 * @param proxy - 可选代理地址。
 */
export async function receiveVipPrivilege(
  creds: BiliCredentials,
  type: number,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.vipPrivilege,
    method: 'POST',
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    bodyParams: { type, csrf: creds.csrf },
    proxy,
  });
}

/**
 * 查询每日经验奖励状态。
 *
 * @param creds - 用户凭据。
 * @param proxy - 可选代理地址。
 */
export async function getExpReward(
  creds: BiliCredentials,
  proxy?: string
): Promise<BiliApiResponse<unknown>> {
  return fetchRequest<BiliApiResponse<unknown>>({
    url: URLS.expReward,
    method: 'GET',
    needSign: false,
    extraHeaders: buildWebHeaders(creds),
    proxy,
  });
}

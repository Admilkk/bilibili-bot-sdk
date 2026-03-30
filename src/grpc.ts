/**
 * @packageDocumentation
 * B站私信 gRPC 客户端（`grpc.biliapi.net:443`）。
 *
 * 功能：
 * - proto 文件按需加载并缓存客户端实例
 * - protobuf 元数据编码（Device / Network / Locale / Metadata）
 * - 会话列表查询、消息拉取、消息发送、已读上报、消息撤回
 */

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';
import { v4 as uuidv4 } from 'uuid';
import { generateEid, generateTraceId, generateWebTicket } from './crypto.js';
import type { BiliCredentials, RawGrpcSession, RawGrpcMsg, MessagePayload } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * proto 文件根目录。
 *
 * 编译后 JS 位于 `bilibili-bot-sdk/dist/`，
 * proto 文件实际位于 `hack-plugin/lib/Bili-Grpc/protos`，
 * 相对路径为 `../../lib/Bili-Grpc/protos`。
 */
const PROTOS_DIR = path.join(__dirname, '..', '..', 'lib', 'Bili-Grpc', 'protos');

// ---------------------------------------------------------------------------
// 客户端缓存
// ---------------------------------------------------------------------------

/** gRPC 客户端实例缓存，避免重复创建连接。 */
const serviceClients = new Map<string, grpc.Client>();

/**
 * 获取（或从缓存中取出）指定 gRPC 服务的客户端实例。
 *
 * @param protoFile - 相对于 PROTOS_DIR 的 proto 文件路径。
 * @param serviceName - 完整服务名（如 `bilibili.im.interface.v1.ImInterface`）。
 * @param address - gRPC 服务地址，默认 `grpc.biliapi.net:443`。
 * @returns 已连接的 gRPC 客户端实例。
 */
async function getServiceClient(
  protoFile: string,
  serviceName: string,
  address = 'grpc.biliapi.net:443'
): Promise<grpc.Client> {
  const key = `${protoFile}|${serviceName}|${address}`;
  if (serviceClients.has(key)) return serviceClients.get(key)!;

  const protoPath = path.join(PROTOS_DIR, protoFile);
  const pkgDef = await protoLoader.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTOS_DIR],
  });

  const descriptor = grpc.loadPackageDefinition(pkgDef);
  let ctor: unknown = descriptor;
  for (const part of serviceName.split('.')) {
    ctor = (ctor as Record<string, unknown>)[part];
    if (!ctor) throw new Error(`gRPC 服务 '${serviceName}' 在 ${protoFile} 中未找到`);
  }

  const client = new (ctor as typeof grpc.Client)(address, grpc.credentials.createSsl(), {
    'grpc.timeout_ms': 15_000,
    'grpc.keepalive_time_ms': 10_000,
    'grpc.keepalive_timeout_ms': 8_000,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc-node.max_session_memory': 50,
  });

  serviceClients.set(key, client);
  return client;
}

// ---------------------------------------------------------------------------
// gRPC 元数据构建
// ---------------------------------------------------------------------------

/**
 * 构造 B站 gRPC 请求所需的 Metadata。
 *
 * 包含设备信息、网络信息、地区信息及鉴权令牌。
 *
 * @param creds - 用户凭据。
 * @param includeTicket - 是否携带 Web Ticket（部分接口需要），默认 `true`。
 * @returns gRPC Metadata 对象。
 */
async function buildMetadata(
  creds: BiliCredentials,
  includeTicket = true
): Promise<grpc.Metadata> {
  const uid = creds.DedeUserID;
  const metadata = new grpc.Metadata();

  // 设备信息（protobuf 编码）
  const root = await protobuf.load(path.join(PROTOS_DIR, 'bilibili/metadata/device/device.proto'));
  const DeviceType = root.lookupType('bilibili.metadata.device.Device');
  const deviceBuf = DeviceType.encode(
    DeviceType.create({
      app_id: 1,
      build: 8020300,
      buvid: 'XU4C85241BF18FBC9C5C20CA1D08F38937711',
      mobi_app: 'android',
      platform: 'android',
      channel: 'yingyongbao',
      brand: 'Xiaomi',
      model: '24031PN0DC',
      osver: '12',
    })
  ).finish();
  metadata.set('x-bili-device-bin', Buffer.from(deviceBuf));

  // 网络信息
  const netRoot = await protobuf.load(path.join(PROTOS_DIR, 'bilibili/metadata/network/network.proto'));
  const NetworkType = netRoot.lookupType('bilibili.metadata.network.Network');
  const netBuf = NetworkType.encode(
    NetworkType.create({ type: 2 }) // 2 = WIFI
  ).finish();
  metadata.set('x-bili-network-bin', Buffer.from(netBuf));

  // 地区/语言信息
  const locRoot = await protobuf.load(path.join(PROTOS_DIR, 'bilibili/metadata/locale/locale.proto'));
  const LocaleType = locRoot.lookupType('bilibili.metadata.locale.Locale');
  const locBuf = LocaleType.encode(
    LocaleType.create({
      c_locale: { language: 'zh', region: 'CN' },
      s_locale: { language: 'zh', region: 'CN' },
    })
  ).finish();
  metadata.set('x-bili-locale-bin', Buffer.from(locBuf));

  // 鉴权
  metadata.set('authorization', `identify_v1 ${creds.access_token}`);
  metadata.set('x-bili-mid', uid);
  metadata.set('te', 'trailers');
  metadata.set('x-bili-aurora-eid', generateEid(uid));
  metadata.set('x-bili-trace-id', generateTraceId());
  metadata.set('app-key', 'android');

  if (includeTicket) {
    const ticket = await generateWebTicket(creds);
    if (ticket?.ticket) metadata.set('x-bili-ticket', ticket.ticket);
  }

  return metadata;
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 查询私信会话列表。
 *
 * @param creds - 用户凭据。
 * @param params - 查询参数。
 * @param params.begin_ts - 起始时间戳（默认 0）。
 * @param params.end_ts - 结束时间戳（默认当前时间）。
 * @param params.size - 每次拉取数量（默认 20）。
 * @param params.session_type - 会话类型（4=全部，默认 4）。
 * @returns 会话列表响应对象。
 */
export async function getSessions(
  creds: BiliCredentials,
  params: {
    begin_ts?: number;
    end_ts?: number;
    size?: number;
    session_type?: number;
    unfollow_fold?: number;
    group_fold?: number;
    sort_rule?: number;
  } = {}
): Promise<{ session_list?: RawGrpcSession[] }> {
  const client = await getServiceClient(
    'bilibili/im/interfaces/v1/im.proto',
    'bilibili.im.interface.v1.ImInterface'
  );
  const req = {
    begin_ts: params.begin_ts ?? 0,
    end_ts: params.end_ts ?? Math.floor(Date.now() / 1000),
    size: params.size ?? 20,
    session_type: params.session_type ?? 4,
    unfollow_fold: params.unfollow_fold ?? 0,
    group_fold: params.group_fold ?? 0,
    sort_rule: params.sort_rule ?? 0,
    teenager_mode: 0,
    lessons_mode: 0,
  };
  const meta = await buildMetadata(creds);
  const call = promisify((client as any).GetSessions.bind(client));
  return call(req, meta);
}

/**
 * 拉取指定用户的私信消息列表。
 *
 * @param creds - 用户凭据。
 * @param talkerId - 聊天对象 UID。
 * @param options - 可选参数。
 * @returns 消息列表响应对象。
 */
export async function getUserMessages(
  creds: BiliCredentials,
  talkerId: number,
  options: {
    session_type?: number;
    end_seqno?: number;
    begin_seqno?: number;
    size?: number;
    order?: number;
  } = {}
): Promise<{ messages?: RawGrpcMsg[] }> {
  const client = await getServiceClient(
    'bilibili/im/interfaces/v1/im.proto',
    'bilibili.im.interface.v1.ImInterface'
  );
  const req = {
    talker_id: talkerId,
    session_type: options.session_type ?? 1,
    end_seqno: options.end_seqno ?? 0,
    begin_seqno: options.begin_seqno ?? 0,
    size: options.size ?? 20,
    order: options.order ?? 0,
    dev_id: uuidv4(),
  };
  const meta = await buildMetadata(creds);
  const call = promisify((client as any).SyncFetchSessionMsgs.bind(client));
  return call(req, meta);
}

/**
 * 发送私信。
 *
 * @param creds - 用户凭据。
 * @param receiverId - 接收方 UID。
 * @param content - 消息内容对象（文本或图片）。
 * @param sessionType - 会话类型（默认 1 = 用户私信）。
 * @returns 发送结果（含 msg_key）。
 */
export async function sendMsg(
  creds: BiliCredentials,
  receiverId: number,
  payload: MessagePayload,
  sessionType = 1
): Promise<{ msg_key?: string | number }> {
  const client = await getServiceClient(
    'bilibili/im/interfaces/v1/im.proto',
    'bilibili.im.interface.v1.ImInterface'
  );

  let msgType: number;
  let msgContent: string;

  if (payload.type === 'image') {
    msgType = 2;
    msgContent = JSON.stringify({
      url: payload.url,
      height: String(payload.height ?? 0),
      width: String(payload.width ?? 0),
      imageType: payload.imageType ?? 'jpeg',
      original: payload.original ?? 1,
      size: payload.size ?? 0,
    });
  } else {
    msgType = 1;
    msgContent = JSON.stringify({ content: payload.text });
  }

  const req = {
    msg: {
      sender_uid: Number(creds.DedeUserID),
      receiver_id: receiverId,
      receiver_type: 'EN_RECVER_TYPE_PEER',
      receiver_type_num: sessionType,
      msg_type: msgType,
      content: msgContent,
      timestamp: Math.floor(Date.now() / 1000),
      dev_id: uuidv4(),
      cli_msg_id: Date.now(),
      msg_seqno: Math.floor(Math.random() * 1_000_000),
      msg_source: 'EN_MSG_SOURCE_ANDRIOD',
    },
  };

  const meta = await buildMetadata(creds);
  const call = promisify((client as any).SendMsg.bind(client));
  return call(req, meta);
}

/**
 * 标记消息已读（上报 ACK）。
 *
 * @param creds - 用户凭据。
 * @param talkerId - 聊天对象 UID。
 * @param ackSeqno - 已读到的最大消息序列号。
 * @param sessionType - 会话类型（默认 1）。
 */
export async function markMessagesAsRead(
  creds: BiliCredentials,
  talkerId: number,
  options: { ack_seqno?: number; session_type?: number } = {}
): Promise<void> {
  const client = await getServiceClient(
    'bilibili/im/interfaces/v1/im.proto',
    'bilibili.im.interface.v1.ImInterface'
  );
  const req = {
    talker_id: talkerId,
    session_type: options.session_type ?? 1,
    ack_seqno: options.ack_seqno ?? 0,
  };
  const meta = await buildMetadata(creds);
  const call = promisify((client as any).UpdateAck.bind(client));
  await call(req, meta);
}

/**
 * 撤回一条已发送的私信。
 *
 * @param creds - 用户凭据。
 * @param talkerId - 聊天对象 UID。
 * @param msgKey - 要撤回的消息 msg_key。
 * @param sessionType - 会话类型（默认 1）。
 */
export async function recallMsg(
  creds: BiliCredentials,
  talkerId: number,
  msgKey: number | string,
  sessionType = 1
): Promise<void> {
  const client = await getServiceClient(
    'bilibili/im/interfaces/v1/im.proto',
    'bilibili.im.interface.v1.ImInterface'
  );
  // B站撤回消息协议：发送一条 msg_type=5 的特殊消息，content 为目标 msg_key
  const req = {
    msg: {
      sender_uid: Number(creds.DedeUserID),
      receiver_id: talkerId,
      receiver_type: 'EN_RECVER_TYPE_PEER',
      msg_type: 5,
      content: String(msgKey),
      timestamp: Math.floor(Date.now() / 1000),
      dev_id: uuidv4(),
      cli_msg_id: Date.now(),
      msg_seqno: Math.floor(Math.random() * 1_000_000),
      msg_source: 'EN_MSG_SOURCE_ANDRIOD',
    },
  };
  const meta = await buildMetadata(creds);
  const call = promisify((client as any).SendMsg.bind(client));
  await call(req, meta);
}

/**
 * 获取关注的动态列表（用于初始化好友列表）。
 *
 * @param creds - 用户凭据。
 * @returns 动态列表响应对象。
 */
export async function getDynamicFollowList(
  creds: BiliCredentials
): Promise<{ items?: Array<{ uid: number; name: string; [key: string]: unknown }> }> {
  const client = await getServiceClient(
    'bilibili/dynamic/interfaces/feed/v1/api.proto',
    'bilibili.dynamic.interfaces.feed.v1.Feed'
  );
  const req = {
    teenagers_mode: 0,
    offset: '',
    update_baseline: '',
    type: 'VIDEO',
  };
  const meta = await buildMetadata(creds);
  const call = promisify((client as any).DynMixUpListViewMore.bind(client));
  return call(req, meta);
}

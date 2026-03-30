/**
 * @packageDocumentation
 * 媒体上传模块。
 *
 * 目前支持将图片上传到 B站 BFS（Bilibili File System），
 * 返回可直接用于图片私信的 HTTPS CDN 地址。
 */

import axios from 'axios';
import FormData from 'form-data';
import { imageSize } from 'image-size';
import type { BiliCredentials, ImageUploadResult } from './types.js';

/** 图片上传接口地址。 */
const UPLOAD_URL = 'https://api.bilibili.com/x/upload/web/image';

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/**
 * 根据 Buffer 魔数推断 MIME 类型。
 * @internal
 */
function inferMimeType(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'image/webp';
  return 'image/jpeg'; // 默认按 JPEG 处理
}

/**
 * MIME 类型转文件扩展名。
 * @internal
 */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[mime] ?? 'jpg';
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 将图片 Buffer 上传至 B站 BFS，返回可用于私信的图片信息。
 *
 * @param buffer - 图片文件的 Buffer 数据。
 * @param creds - 用户凭据（需要 SESSDATA、csrf）。
 * @param proxy - 可选 HTTP 代理地址。
 * @returns 上传成功后的图片信息（URL、宽高、存储路径）。
 *
 * @example
 * ```ts
 * import { uploadImage } from 'bilibili-bot-sdk';
 * import fs from 'fs';
 *
 * const buf = fs.readFileSync('./photo.jpg');
 * const result = await uploadImage(buf, credentials);
 * console.log(result.image_url);
 * ```
 */
export async function uploadImage(
  buffer: Buffer,
  creds: BiliCredentials,
  proxy?: string
): Promise<ImageUploadResult> {
  const mime = inferMimeType(buffer);
  const ext = mimeToExt(mime);
  const filename = `${Date.now()}.${ext}`;

  const form = new FormData();
  form.append('file_up', buffer, {
    filename,
    contentType: mime,
  });
  form.append('bucket', 'openplatform');
  form.append('csrf', creds.csrf);

  const headers: Record<string, string> = {
    ...form.getHeaders(),
    Cookie: `SESSDATA=${creds.SESSDATA}; bili_jct=${creds.csrf}; access_key=${creds.access_token}`,
    'User-Agent':
      'Mozilla/5.0 BiliDroid/8.2.0 (bbcallen@gmail.com) os/android model/24031PN0DC mobi_app/android build/8020300 channel/yingyongbao innerVer/8020300 osVer/12 network/2',
    Referer: 'https://www.bilibili.com/',
  };

  const axiosConfig: Record<string, unknown> = { headers, timeout: 30_000 };
  if (proxy) {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
  }

  const response = await axios.post(UPLOAD_URL, form, axiosConfig);

  if (response.data.code !== 0) {
    throw new Error(`B站图片上传失败: ${response.data.message ?? '未知错误'}`);
  }

  // 强制 HTTPS
  if (response.data.data?.location) {
    response.data.data.location = response.data.data.location.replace('http://', 'https://');
  }

  // 获取图片尺寸
  let image_width = 0;
  let image_height = 0;
  try {
    const size = imageSize(buffer);
    image_width = size.width ?? 0;
    image_height = size.height ?? 0;
  } catch {
    // 无法获取尺寸时不阻断流程
  }

  const data = response.data.data;
  return {
    image_url: (data.image_url as string) ?? `https:${data.location}`,
    image_width: (data.image_width as number) ?? image_width,
    image_height: (data.image_height as number) ?? image_height,
    location: data.location as string,
  };
}

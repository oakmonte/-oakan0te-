import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config';
import type { MediaType, UploadResult } from '../types/domain';

/**
 * IMPORTANT — READ BEFORE USING IN PRODUCTION
 * ---------------------------------------------
 * Bumpa does not (as of writing) publish a fully open, self-serve REST API
 * reference the way Shopify does — their documented surface lives behind a
 * Postman collection (docs.bumpa.io) and merchant-specific API access is
 * typically granted by their support team on request.
 *
 * This adapter is a working SCAFFOLD: correct shape (auth header, multipart
 * upload, retry-friendly single responsibility), but the exact endpoint path,
 * field names, and response shape below are placeholders you must confirm
 * with Bumpa (ask support for their current product-media-upload endpoint
 * and a sample request/response) and then adjust in the two spots marked
 * TODO below. Everything else in the pipeline (queueing, retries, status
 * tracking) works the same regardless of what you change here.
 */

const client = axios.create({
  baseURL: config.bumpa.baseUrl,
  headers: {
    Authorization: `Bearer ${config.bumpa.apiKey}`,
  },
  timeout: 60_000,
});

export interface BumpaUploadInput {
  productRef: string;
  filePath: string;
  mediaType: MediaType;
}

interface BumpaResponseShape {
  id?: string;
  data?: { id?: string };
}

export async function uploadMedia({ productRef, filePath, mediaType }: BumpaUploadInput): Promise<UploadResult> {
  const filename = path.basename(filePath);

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), filename);
  form.append('type', mediaType); // TODO: confirm Bumpa's expected field name/value for media type

  // TODO: confirm exact endpoint path and productRef param name with Bumpa support.
  const res = await client.post<BumpaResponseShape>(`/v1/products/${productRef}/media`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  // TODO: adjust to match Bumpa's actual response envelope.
  return {
    remoteMediaId: res.data?.id ?? res.data?.data?.id ?? null,
    status: res.status,
  };
}

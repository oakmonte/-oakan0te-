import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config';
import type { MediaType, UploadResult } from '../types/domain';

const { storeDomain, adminToken, apiVersion } = config.shopify;
const GRAPHQL_URL = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

const gqlClient = axios.create({
  baseURL: GRAPHQL_URL,
  headers: {
    'X-Shopify-Access-Token': adminToken,
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
});

interface GraphQLResponse<T> {
  data: T;
  errors?: unknown[];
}

async function graphql<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await gqlClient.post<GraphQLResponse<T>>('', { query, variables });
  if (res.data.errors && res.data.errors.length) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(res.data.errors)}`);
  }
  const userErrors = findUserErrors(res.data.data);
  if (userErrors && userErrors.length) {
    throw new Error(`Shopify userErrors: ${JSON.stringify(userErrors)}`);
  }
  return res.data.data;
}

function findUserErrors(data: any): Array<{ field: string; message: string }> | null {
  if (!data) return null;
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val && Array.isArray(val.userErrors) && val.userErrors.length) {
      return val.userErrors;
    }
  }
  return null;
}

const STAGED_UPLOADS_CREATE = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const PRODUCT_CREATE_MEDIA = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage { id status }
        ... on Video { id status }
      }
      mediaUserErrors { field message }
      userErrors: mediaUserErrors { field message }
    }
  }
`;

function mimeFor(mediaType: MediaType, filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (mediaType === 'video') return 'video/mp4';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

interface StagedTarget {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
}

interface StagedUploadsCreateResponse {
  stagedUploadsCreate: {
    stagedTargets: StagedTarget[];
    userErrors: Array<{ field: string; message: string }>;
  };
}

interface ProductCreateMediaResponse {
  productCreateMedia: {
    media: Array<{ id: string; status: string }>;
    mediaUserErrors: Array<{ field: string; message: string }>;
  };
}

export interface ShopifyUploadInput {
  productGid: string;
  filePath: string;
  mediaType: MediaType;
}

/**
 * Step 1: ask Shopify for a signed upload target (S3/GCS-backed staged upload).
 * Step 2: upload the raw file bytes directly to that target (not through Shopify's API).
 * Step 3: attach the uploaded resource to the product via productCreateMedia.
 * This is the current recommended flow — the old REST /products/{id}/images.json
 * endpoint is legacy and doesn't support video at all.
 */
export async function uploadMedia({ productGid, filePath, mediaType }: ShopifyUploadInput): Promise<UploadResult> {
  const filename = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const mimeType = mimeFor(mediaType, filePath);
  const resource = mediaType === 'video' ? 'VIDEO' : 'IMAGE';

  const stagedData = await graphql<StagedUploadsCreateResponse>(STAGED_UPLOADS_CREATE, {
    input: [
      {
        resource,
        filename,
        mimeType,
        fileSize: String(fileSize),
        httpMethod: 'POST',
      },
    ],
  });

  const target = stagedData.stagedUploadsCreate.stagedTargets[0];

  const form = new FormData();
  for (const { name, value } of target.parameters) {
    form.append(name, value);
  }
  form.append('file', fs.createReadStream(filePath), filename);

  await axios.post(target.url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const mediaData = await graphql<ProductCreateMediaResponse>(PRODUCT_CREATE_MEDIA, {
    productId: productGid,
    media: [
      {
        originalSource: target.resourceUrl,
        mediaContentType: resource,
      },
    ],
  });

  const created = mediaData.productCreateMedia.media[0];
  return { remoteMediaId: created.id, status: created.status };
}

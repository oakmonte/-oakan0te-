export type Platform = 'shopify' | 'bumpa';
export type MediaType = 'image' | 'video';
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface MediaJobRow {
  id: string;
  batchId: string;
  platform: Platform;
  productRef: string;
  filePath: string;
  mediaType: MediaType;
}

export interface MediaJobData {
  jobRowId: string;
  productRef: string;
  filePath: string;
  mediaType: MediaType;
}

export interface UploadResult {
  remoteMediaId: string | null;
  status: string | number;
}

export interface BatchMappingEntry {
  shopifyProductGid?: string;
  bumpaProductId?: string;
}

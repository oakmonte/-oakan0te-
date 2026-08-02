import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3000),
  uploadTmpDir: process.env.UPLOAD_TMP_DIR || './tmp-uploads',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  dbPath: process.env.DB_PATH || './data/jobs.sqlite',

  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
    adminToken: process.env.SHOPIFY_ADMIN_TOKEN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
    concurrency: Number(process.env.SHOPIFY_WORKER_CONCURRENCY || 4),
  },

  bumpa: {
    baseUrl: process.env.BUMPA_API_BASE_URL || 'https://api.bumpa.io',
    apiKey: process.env.BUMPA_API_KEY || '',
    concurrency: Number(process.env.BUMPA_WORKER_CONCURRENCY || 4),
  },

  shipbubble: {
    baseUrl: process.env.SHIPBUBBLE_BASE_URL || 'https://api.shipbubble.com/v1',
    apiKey: process.env.SHIPBUBBLE_API_KEY || '',
  },
};

export type AppConfig = typeof config;

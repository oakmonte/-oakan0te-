declare const process: {
  env: Record<string, string | undefined>;
};

// Injected by vite.config.ts's `define` — a fresh value baked in once per
// `vite build`, identical across that build's server and client bundles.
declare const __BUILD_ID__: string;

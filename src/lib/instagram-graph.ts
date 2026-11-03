/**
 * Instagram connects through Meta's unified login, so every call goes to
 * graph.facebook.com. Tokens from unified login are rejected by
 * graph.instagram.com, the host the old Instagram Business Login used.
 */
export const GRAPH_VERSION = "v25.0";
export const GRAPH_HOST = "graph.facebook.com";
export const GRAPH_BASE = `https://${GRAPH_HOST}/${GRAPH_VERSION}`;

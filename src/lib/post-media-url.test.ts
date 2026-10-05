import { expect, test } from "bun:test";
import { isOwnPostMediaUrl } from "./post-media-url";

const zone = "cdn.oakmonte.store";
const me = "3a236f3b-cff2-4f7c-a6b9-f8b6206edd26";
const other = "525ed2f3-5a5a-4d42-bc9f-a2cbb5e60e1e";
const folder = "ee9b1709-69ef-4eb4-a405-0ca8589bbac0";
const ok = (u: string) => isOwnPostMediaUrl(u, zone, me);

test("accepts exactly what /api/post-media writes", () => {
  expect(ok(`https://${zone}/posts/${me}/${folder}/media-0.jpg`)).toBe(true);
  expect(ok(`https://${zone}/posts/${me}/${folder}/media-12.webp`)).toBe(true);
  expect(ok(`https://${zone}/posts/${me}/${folder}/thumbnail.png`)).toBe(true);
});

test("rejects other users' files, however the path is dressed up", () => {
  expect(ok(`https://${zone}/posts/${other}/${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/%2e%2e/${other}/${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/.%2e/${other}/${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/../${other}/${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}//${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/${folder}/sub/media-0.jpg`)).toBe(false);
});

test("rejects other hosts, schemes, queries and odd names", () => {
  expect(ok(`https://${zone}.evil.com/posts/${me}/${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`https://evil.com/posts/${me}/${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`http://${zone}/posts/${me}/${folder}/media-0.jpg`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/${folder}/media-0.jpg?x=1`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/${folder}/media-0.jpg#x`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/${folder}/audio.mp3`)).toBe(false);
  expect(ok(`https://${zone}/posts/${me}/not-a-uuid/media-0.jpg`)).toBe(false);
  expect(ok(42)).toBe(false);
  expect(ok("not a url")).toBe(false);
});

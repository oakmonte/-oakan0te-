import { describe, expect, test } from "bun:test";
import { rewriteStoreHostIn, rewriteStoreHostOut, storeFromHost } from "./store-host";

describe("storeFromHost", () => {
  test("a store subdomain names its store", () => {
    expect(storeFromHost("reazy.oakmonte.store")).toBe("reazy");
    expect(storeFromHost("by-invitation.oakmonte.store")).toBe("by-invitation");
    expect(storeFromHost("Reazy.Oakmonte.Store")).toBe("reazy");
    expect(storeFromHost("reazy.localhost")).toBe("reazy");
  });

  test("the root, reserved names and deeper hosts are not stores", () => {
    expect(storeFromHost("oakmonte.store")).toBeNull();
    expect(storeFromHost("www.oakmonte.store")).toBeNull();
    expect(storeFromHost("cdn.oakmonte.store")).toBeNull();
    expect(storeFromHost("a.b.oakmonte.store")).toBeNull();
    expect(storeFromHost("localhost")).toBeNull();
    expect(storeFromHost("oakmonte-git-x.vercel.app")).toBeNull();
    expect(storeFromHost("evil-oakmonte.store")).toBeNull();
  });
});

describe("router rewrite", () => {
  test("a store subdomain's home becomes its /shop page, and back", () => {
    const inner = rewriteStoreHostIn(new URL("https://reazy.oakmonte.store/?x=1"));
    expect(inner?.pathname).toBe("/shop/reazy");
    expect(inner?.search).toBe("?x=1");
    expect(rewriteStoreHostOut(new URL("https://reazy.oakmonte.store/shop/reazy"))?.pathname).toBe(
      "/",
    );
  });

  test("other paths and hosts pass through untouched", () => {
    expect(rewriteStoreHostIn(new URL("https://reazy.oakmonte.store/cart"))).toBeUndefined();
    expect(rewriteStoreHostIn(new URL("https://oakmonte.store/"))).toBeUndefined();
    expect(rewriteStoreHostOut(new URL("https://reazy.oakmonte.store/shop/other"))).toBeUndefined();
    expect(rewriteStoreHostOut(new URL("https://oakmonte.store/shop/reazy"))).toBeUndefined();
  });
});

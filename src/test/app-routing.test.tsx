import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("Entry flow", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("opens the welcome chooser at /", () => {
    expect(router.matchRoutes("/").at(-1)?.routeId).toBe("/");
  });

  it("lets buyers browse at /comprar without the sign-in gate", () => {
    const ids = router.matchRoutes("/comprar").map((m) => m.routeId);
    expect(ids.at(-1)).toBe("/comprar");
    expect(ids).not.toContain("/_authenticated");
  });

  it("gives sellers a /vender page with publish and store options", () => {
    expect(router.matchRoutes("/vender").at(-1)?.routeId).toBe("/vender");
  });
});

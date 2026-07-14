import { ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";

export const convexClient = new ConvexReactClient(url);

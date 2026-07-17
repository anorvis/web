import { ConvexReactClient } from "convex/react";
import { convexDeploymentUrl } from "@/lib/convex-url";

export const convexClient = new ConvexReactClient(convexDeploymentUrl);

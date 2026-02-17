import { Roles } from "./roles.js";

export const agents = [
  // ... existing agents ...
  {
    id: "REVIEWER001",
    role: Roles.CODING,
    capabilities: ["actions.review", "security.scan", "mcp-client"]
  }
];

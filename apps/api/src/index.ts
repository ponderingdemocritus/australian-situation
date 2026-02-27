import { serve } from "@hono/node-server";
import { app } from "./app";

serve(
  {
    fetch: app.fetch,
    port: 3001
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);

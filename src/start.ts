import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// This app uses its own signed instructor tokens (see src/lib/db.ts), so no
// client-side Supabase bearer middleware is registered here on purpose.
export const startInstance = createStart(() => ({
  functionMiddleware: [],
  requestMiddleware: [errorMiddleware],
}));

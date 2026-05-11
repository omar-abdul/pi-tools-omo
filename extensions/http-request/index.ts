import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const MAX_BODY_PREVIEW = 200_000; // characters returned in tool content

const HttpMethod = Type.Union([
  Type.Literal("GET"),
  Type.Literal("POST"),
  Type.Literal("PUT"),
  Type.Literal("PATCH"),
  Type.Literal("DELETE"),
  Type.Literal("HEAD"),
  Type.Literal("OPTIONS"),
]);

type HttpMethodType = typeof HttpMethod extends { static: infer T } ? T : string;

export default function registerHttpRequestExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "http_request",
    label: "HTTP Request",
    description:
      "Fetch data from HTTP/HTTPS endpoints (documentation, APIs). Supports custom method, headers, and body.",
    promptSnippet: "Retrieve web docs or JSON via http_request when you need online references.",
    promptGuidelines: [
      "Prefer this tool for fetching documentation or API responses instead of guessing.",
      "Always summarize the fetched content for the user after calling the tool.",
      "Respect CORS limitations do not apply because this runs server-side, but only access URLs the user requests.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "HTTP or HTTPS URL to fetch" }),
      method: Type.Optional(HttpMethod),
      headers: Type.Optional(
        Type.Record(Type.String(), Type.String(), {
          description: "Additional request headers (key-value pairs)",
        }),
      ),
      body: Type.Optional(
        Type.String({ description: "Request body (use with POST/PUT/PATCH as needed)" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const url = params.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        throw new Error("Only http(s) URLs are supported");
      }

      const method = (params.method ?? "GET").toUpperCase() as HttpMethodType;
      const controller = new AbortController();
      const abortHandler = () => controller.abort();
      signal?.addEventListener("abort", abortHandler);

      try {
        const response = await fetch(url, {
          method,
          headers: params.headers,
          body: params.body,
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";
        let bodyText: string;
        try {
          bodyText = await response.text();
        } catch (err) {
          bodyText = `[Failed to read body: ${(err as Error).message}]`;
        }

        const truncated = bodyText.length > MAX_BODY_PREVIEW;
        const preview = truncated ? bodyText.slice(0, MAX_BODY_PREVIEW) : bodyText;

        const textOutput = `URL: ${response.url}\nStatus: ${response.status} ${response.statusText}\nContent-Type: ${contentType}\nTruncated: ${truncated}\n\n${preview}`;

        const headersRecord = Object.fromEntries(response.headers.entries());

        return {
          content: [{ type: "text", text: textOutput }],
          details: {
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: headersRecord,
            truncated,
            body: truncated ? preview : bodyText,
          },
          isError: !response.ok,
        };
      } finally {
        signal?.removeEventListener("abort", abortHandler);
      }
    },
  });
}

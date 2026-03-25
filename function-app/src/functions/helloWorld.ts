import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export const HELLO_WORLD_TEXT = "Hello World";

export function buildHelloWorldResponse(): HttpResponseInit {
  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
    body: HELLO_WORLD_TEXT,
  };
}

export async function helloWorldHandler(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Hello World endpoint invoked.");

  return buildHelloWorldResponse();
}

app.http("helloWorld", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "",
  handler: helloWorldHandler,
});

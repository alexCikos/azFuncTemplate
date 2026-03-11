/**
 * HTTP-triggered Azure Function for starting the overdue reminder email flow.
 *
 * This entrypoint resolves runtime configuration, builds the workflow
 * dependencies, and hands control to the workflow scaffold without embedding
 * business logic directly in the Azure Function handler.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { sendEmail } from "../clients/emailClient";
import { getSharePointListItems } from "../clients/sharepointClient";
import {
  runOverdueReminderEmailsWorkflow,
  type RunOverdueReminderEmailsWorkflowInput,
} from "./sendOverdueReminderEmails/runOverdueReminderEmailsWorkflow";
import { getGraphAccessToken } from "../tools/getGraphAccessToken";

/**
 * Optional request body supported by the overdue reminder email endpoint.
 */
type SendOverdueReminderEmailRequest = {
  /**
   * Optional OData filter passed through to the SharePoint list query.
   */
  filter?: string;
};

/**
 * Error raised when the incoming HTTP request payload is invalid.
 */
class BadRequestError extends Error {}

/**
 * Reads a required application setting from the Azure Functions runtime
 * environment.
 *
 * @param name The application setting name to resolve from `process.env`.
 * @returns The trimmed application setting value.
 */
function readRequiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required application setting: ${name}`);
  }

  return value;
}

/**
 * Reads the optional workflow request data from the HTTP query string or JSON
 * request body.
 *
 * @param req The incoming HTTP request for the overdue reminder endpoint.
 * @returns The normalized workflow request payload extracted from the request.
 * When both a query-string filter and a JSON body filter are provided, the JSON
 * body filter takes precedence.
 */
async function readWorkflowRequest(
  req: HttpRequest,
): Promise<SendOverdueReminderEmailRequest> {
  const filter = req.query.get("filter")?.trim();
  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return filter ? { filter } : {};
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON.");
  }

  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new BadRequestError("Request body must be a JSON object.");
  }

  const requestBody = payload as SendOverdueReminderEmailRequest;
  const bodyFilter =
    typeof requestBody.filter === "string"
      ? requestBody.filter.trim()
      : undefined;

  return {
    filter: bodyFilter || filter,
  };
}

/**
 * Handles POST requests for the overdue reminder email endpoint.
 *
 * @param req The incoming HTTP request that triggers the reminder workflow.
 * @param context The Azure Functions invocation context used for logging and runtime metadata.
 * @returns An HTTP response containing the scaffolded workflow result.
 */
export async function sendOverdueReminderEmailHandler(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const request = await readWorkflowRequest(req);

    const workflowInput: RunOverdueReminderEmailsWorkflowInput = {
      siteId: readRequiredSetting("SHAREPOINT_SITE_ID"),
      listId: readRequiredSetting("SHAREPOINT_LIST_ID"),
      senderMailbox: readRequiredSetting("SHARED_MAILBOX"),
      filter: request.filter,
      subjectTemplate: "Overdue Invoice Reminder - {InvoiceNumber}",
      emailBodyTemplate:
        "Dear {ClientName},\n\nOur records indicate that invoice #{InvoiceNumber} was due on {DueDate}. Please arrange for payment at your earliest convenience.\n\nThank you,\nFinance Team",
    };

    // Keep the handler responsible for runtime configuration so the workflow
    // and client helpers stay testable with explicit inputs.
    const result = await runOverdueReminderEmailsWorkflow(
      {
        getGraphAccessToken: () =>
          getGraphAccessToken({
            tenantId: readRequiredSetting("GRAPH_TENANT_ID"),
            clientId: readRequiredSetting("GRAPH_CLIENT_ID"),
            clientSecret: readRequiredSetting("GRAPH_CLIENT_SECRET"),
            scope: process.env.GRAPH_SCOPE?.trim() || undefined,
          }),
        getSharePointListItems,
        sendEmail,
        log: (...args) => context.log(...args),
      },
      workflowInput,
    );

    return {
      status: 200,
      jsonBody: {
        ok: true,
        result,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown function error.";

    context.error("sendOverdueReminderEmailHandler failed", {
      error: message,
    });

    return {
      status: error instanceof BadRequestError ? 400 : 500,
      jsonBody: {
        ok: false,
        error: message,
      },
    };
  }
}

app.http("send-overdue-reminder-email", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: sendOverdueReminderEmailHandler,
});

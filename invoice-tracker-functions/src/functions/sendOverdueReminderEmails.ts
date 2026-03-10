/**
 * HTTP-triggered Azure Function for starting the overdue reminder email flow.
 *
 * The current implementation is a placeholder that logs the invocation and
 * returns a success response until the SharePoint lookup and email delivery
 * steps are wired in.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

/**
 * Handles POST requests for the overdue reminder email endpoint.
 *
 * @param req The incoming HTTP request that triggers the reminder workflow.
 * @param context The Azure Functions invocation context used for logging and runtime metadata.
 * @returns A successful HTTP response confirming the placeholder workflow was invoked.
 */
export async function sendOverdueReminderEmailHandler(
  req: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  // Placeholder implementation - replace with actual logic to read overdue invoices and send reminder emails.
  context.log("sendOverdueReminderEmailHandler invoked");
  return {
    status: 200,
    body: "Overdue reminder emails sent (placeholder response)",
  };
}

app.http("send-overdue-reminder-email", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: sendOverdueReminderEmailHandler,
});

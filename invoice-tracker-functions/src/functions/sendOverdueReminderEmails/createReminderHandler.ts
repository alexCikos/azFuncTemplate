import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { sendEmail } from "../../clients/emailClient";
import { getSharePointListItems } from "../../clients/sharepointClient";
import { getGraphAccessToken } from "../../tools/getGraphAccessToken";
import {
  runOverdueReminderEmailsWorkflow,
  type RunOverdueReminderEmailsWorkflowInput,
} from "./runOverdueReminderEmailsWorkflow";

/**
 * JSON-backed handler definition for a reminder endpoint.
 */
export type ReminderHandlerDefinition = {
  subjectTemplate: string;
  emailBodyTemplate: string;
  filter: string;
};

/**
 * Normalized handler registration used when wiring Azure Function endpoints.
 */
export type ReminderHandlerRegistration = {
  functionName: string;
  definition: ReminderHandlerDefinition;
};

function readRequiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required application setting: ${name}`);
  }

  return value;
}

function normalizeReminderHandlerDefinition(
  functionName: string,
  definition: unknown,
): ReminderHandlerRegistration {
  if (typeof definition !== "object" || definition === null) {
    throw new Error(
      `Reminder handler config "${functionName}" must be a JSON object.`,
    );
  }

  const config = definition as Partial<ReminderHandlerDefinition>;
  const subjectTemplate =
    typeof config.subjectTemplate === "string"
      ? config.subjectTemplate.trim()
      : "";
  const emailBodyTemplate =
    typeof config.emailBodyTemplate === "string"
      ? config.emailBodyTemplate.trim()
      : "";
  const rawFilter =
    typeof config.filter === "string" ? config.filter.trim() : null;

  if (!subjectTemplate) {
    throw new Error(
      `Reminder handler config "${functionName}" is missing subjectTemplate.`,
    );
  }

  if (!emailBodyTemplate) {
    throw new Error(
      `Reminder handler config "${functionName}" is missing emailBodyTemplate.`,
    );
  }

  if (rawFilter === null) {
    throw new Error(
      `Reminder handler config "${functionName}" is missing filter.`,
    );
  }

  return {
    functionName,
    definition: {
      subjectTemplate,
      emailBodyTemplate,
      filter: rawFilter,
    },
  };
}

/**
 * Converts raw JSON config into validated reminder handler registrations.
 */
export function parseReminderHandlerRegistrations(
  rawConfig: unknown,
): ReminderHandlerRegistration[] {
  if (typeof rawConfig !== "object" || rawConfig === null || Array.isArray(rawConfig)) {
    throw new Error("Reminder handler config file must be a JSON object.");
  }

  return Object.entries(rawConfig).map(([functionName, definition]) =>
    normalizeReminderHandlerDefinition(functionName, definition),
  );
}

/**
 * Creates an Azure Function HTTP handler for a single reminder definition.
 */
export function createReminderHandler(
  functionName: string,
  definition: ReminderHandlerDefinition,
): (
  req: HttpRequest,
  context: InvocationContext,
) => Promise<HttpResponseInit> {
  return async function reminderHandler(
    _req: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> {
    try {
      context.log("Reminder handler invoked", {
        functionName,
        filter: definition.filter,
      });

      const workflowInput: RunOverdueReminderEmailsWorkflowInput = {
        siteId: readRequiredSetting("SHAREPOINT_SITE_ID"),
        listId: readRequiredSetting("SHAREPOINT_LIST_ID"),
        senderMailbox: readRequiredSetting("SHARED_MAILBOX"),
        filter: definition.filter,
        subjectTemplate: definition.subjectTemplate,
        emailBodyTemplate: definition.emailBodyTemplate,
      };

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
          log: (...args) => {
            const [message, ...rest] = args;

            if (typeof message === "string") {
              context.log(`[${functionName}] ${message}`, ...rest);
              return;
            }

            context.log(message, ...rest);
          },
        },
        workflowInput,
      );

      context.log("Reminder handler completed", {
        functionName,
        status: result.status,
        matchedCount: result.matchedCount,
        sentCount: result.sentCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
      });

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

      context.error("Reminder handler failed", {
        functionName,
        filter: definition.filter,
        error: message,
      });

      return {
        status: 500,
        jsonBody: {
          ok: false,
          error: message,
        },
      };
    }
  };
}

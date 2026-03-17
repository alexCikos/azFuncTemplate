import type {
  Result as SendEmailResult,
  SendEmailArgs,
} from "../../clients/emailClient";
import type { InvoiceReminderItem } from "../../mapper/mapInvoiceFields";
import { retryOnDns } from "../../tools/errorHandlers";

/**
 * Placeholder values available in subject and body templates.
 */
type ReminderTemplateValues = {
  ClientName: string;
  InvoiceNumber: string;
  InvoiceId: string;
  DueDate: string;
};

/**
 * Runtime dependencies injected into the workflow for Graph access, data
 * loading, email sending, and logging.
 */
export type RunOverdueReminderEmailsWorkflowDeps = {
  getGraphAccessToken: () => Promise<string>;
  getSharePointListItems: (
    graphAccessToken: string,
    filter: string,
    siteId: string,
    listId: string,
  ) => Promise<InvoiceReminderItem[]>;
  sendEmail: (args: SendEmailArgs) => Promise<SendEmailResult>;
  log: (...args: unknown[]) => void;
};

/**
 * Request-scoped configuration needed to run the overdue reminder workflow.
 */
export type RunOverdueReminderEmailsWorkflowInput = {
  siteId: string;
  listId: string;
  senderMailbox: string;
  filter?: string;
  emailBodyTemplate: string;
  subjectTemplate: string;
};

/**
 * Summary returned after the workflow finishes processing the current invoice
 * match set.
 */
export type RunOverdueReminderEmailsWorkflowResult = {
  status: "completed" | "completed_with_failures";
  message: string;
  matchedCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  siteId: string;
  listId: string;
  senderMailbox: string;
  filter?: string;
};

function buildReminderTemplateValues(
  item: InvoiceReminderItem,
): ReminderTemplateValues {
  const invoiceReference = item.InvoiceNumber ?? item.Id ?? "unknown invoice";

  return {
    ClientName: item.ClientName ?? "customer",
    InvoiceNumber: invoiceReference,
    InvoiceId: item.Id ?? invoiceReference,
    DueDate: item.DueDate ?? "the recorded due date",
  };
}

function renderReminderTemplate(
  template: string,
  values: ReminderTemplateValues,
): string {
  return template.replace(
    /{(ClientName|InvoiceNumber|InvoiceId|DueDate)}/g,
    (_, key: keyof ReminderTemplateValues) => values[key],
  );
}

/**
 * Runs the overdue reminder workflow and returns a per-run summary.
 *
 * Token and list failures stop the run immediately, while email failures stay
 * item-scoped so other reminders can still be attempted.
 */
export async function runOverdueReminderEmailsWorkflow(
  deps: RunOverdueReminderEmailsWorkflowDeps,
  input: RunOverdueReminderEmailsWorkflowInput,
): Promise<RunOverdueReminderEmailsWorkflowResult> {
  deps.log("runOverdueReminderEmailsWorkflow invoked", {
    siteId: input.siteId,
    listId: input.listId,
    senderMailbox: input.senderMailbox,
    hasFilter: Boolean(input.filter),
  });

  // Token acquisition and list reads are prerequisites for the whole run, so
  // those dependencies throw on failure instead of returning item-level results.
  const graphAccessToken: string = await deps.getGraphAccessToken();
  deps.log("Acquired Graph access token", {
    tokenLength: graphAccessToken.length,
  });

  const getSPItemsResult: InvoiceReminderItem[] =
    await deps.getSharePointListItems(
      graphAccessToken,
      input.filter || "",
      input.siteId,
      input.listId,
    );
  deps.log("Retrieved items from SharePoint", {
    itemCount: getSPItemsResult.length,
  });

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const [index, item] of getSPItemsResult.entries()) {
    deps.log(`Item ${index + 1}`, {
      id: item.Id,
      clientName: item.ClientName,
      dueDate: item.DueDate,
      recipientEmail: item.ClientEmail,
    });

    if (!item.ClientEmail) {
      skippedCount += 1;
      deps.log(`Skipping reminder email for item ${item.Id ?? index + 1}`, {
        reason: "Missing ClientEmail",
      });
      continue;
    }

    const templateValues = buildReminderTemplateValues(item);

    const emailArgs: SendEmailArgs = {
      graphAccessToken,
      senderMailbox: input.senderMailbox,
      recipientEmail: item.ClientEmail,
      subject: renderReminderTemplate(input.subjectTemplate, templateValues),
      bodyText: renderReminderTemplate(input.emailBodyTemplate, templateValues),
    };

    try {
      // A transient DNS failure should not fail the whole batch, so email sends
      // get a small retry window while other send failures stay item-scoped.
      const retryResult = await retryOnDns(deps.sendEmail, emailArgs, {
        onRetry: ({ attempt, nextAttempt, result, waitMs }) => {
          deps.log(
            `Retrying reminder email for item ${item.Id ?? index + 1} after DNS error`,
            {
              attempt,
              nextAttempt,
              waitMs,
              error: result.errorMessage,
              errorCode: result.errorCode,
            },
          );
        },
      });

      if (retryResult.result.isError) {
        failedCount += 1;
        deps.log(
          `Failed to send reminder email for item ${item.Id ?? index + 1}`,
          {
            attempt: retryResult.attempts,
            error: retryResult.result.errorMessage,
            errorCode: retryResult.result.errorCode,
            statusCode: retryResult.result.statusCode,
          },
        );
        continue;
      }

      sentCount += 1;
      deps.log(
        `Successfully sent reminder email for item ${item.Id ?? index + 1}`,
        { attempt: retryResult.attempts },
      );
    } catch (error) {
      failedCount += 1;
      deps.log(
        `Failed to send reminder email for item ${item.Id ?? index + 1}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  const matchedCount = getSPItemsResult.length;
  const status = failedCount > 0 ? "completed_with_failures" : "completed";

  return {
    status,
    message: `Workflow completed. Matched ${matchedCount} item(s), sent ${sentCount}, skipped ${skippedCount}, failed ${failedCount}.`,
    matchedCount,
    sentCount,
    skippedCount,
    failedCount,
    siteId: input.siteId,
    listId: input.listId,
    senderMailbox: input.senderMailbox,
    filter: input.filter,
  };
}

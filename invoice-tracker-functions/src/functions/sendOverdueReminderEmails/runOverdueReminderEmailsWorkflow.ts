/**
 * Workflow for the overdue reminder email orchestration.
 *
 * This module defines the contract between the Azure Function entrypoint and
 * the business workflow so the orchestration can be tested with injected
 * dependencies and return a structured execution summary.
 */

import type { SendEmailArgs } from "../../clients/emailClient";
import type { InvoiceReminderItem } from "../../mapper/mapInvoiceFields";

/**
 * Placeholder values available when rendering reminder email templates.
 */
type ReminderTemplateValues = {
  /**
   * Client display name used in reminder content.
   */
  ClientName: string;
  /**
   * Preferred invoice reference shown in reminder content.
   */
  InvoiceNumber: string;
  /**
   * Backwards-compatible invoice identifier placeholder.
   */
  InvoiceId: string;
  /**
   * Due date shown in reminder content.
   */
  DueDate: string;
};

/**
 * Dependency contract for the overdue reminder workflow.
 */
export type RunOverdueReminderEmailsWorkflowDeps = {
  /**
   * Acquires an app-only Microsoft Graph access token for downstream API calls.
   */
  getGraphAccessToken: () => Promise<string>;
  /**
   * Reads invoice records from SharePoint and maps them into the workflow model.
   */
  getSharePointListItems: (
    graphAccessToken: string,
    filter: string,
    siteId: string,
    listId: string,
  ) => Promise<InvoiceReminderItem[]>;
  /**
   * Sends a reminder email for a specific invoice recipient.
   */
  sendEmail: (args: SendEmailArgs) => Promise<void>;
  /**
   * Writes workflow diagnostics to the configured logger.
   */
  log: (...args: unknown[]) => void;
};

/**
 * Request-specific values required by the overdue reminder workflow.
 */
export type RunOverdueReminderEmailsWorkflowInput = {
  /**
   * The SharePoint site identifier that owns the invoice list.
   */
  siteId: string;
  /**
   * The SharePoint list identifier containing invoice records.
   */
  listId: string;
  /**
   * The mailbox used as the sender for reminder emails.
   */
  senderMailbox: string;
  /**
   * Optional OData filter used to narrow the SharePoint list query.
   */
  filter?: string;
  /**
   * Email body template used for reminder emails. Supported placeholders are
   * `{ClientName}`, `{InvoiceNumber}`, `{InvoiceId}`, and `{DueDate}`.
   */
  emailBodyTemplate: string;
  /**
   * Email subject template used for reminder emails. Supported placeholders are
   * `{ClientName}`, `{InvoiceNumber}`, `{InvoiceId}`, and `{DueDate}`.
   */
  subjectTemplate: string;
};

/**
 * Result returned by the overdue reminder workflow after processing the
 * current SharePoint match set.
 */
export type RunOverdueReminderEmailsWorkflowResult = {
  /**
   * The workflow completion state.
   */
  status: "completed" | "completed_with_failures";
  /**
   * Human-readable description of the workflow outcome.
   */
  message: string;
  /**
   * Number of SharePoint items returned by the configured filter.
   */
  matchedCount: number;
  /**
   * Number of reminder emails successfully sent.
   */
  sentCount: number;
  /**
   * Number of matched items skipped by the workflow.
   */
  skippedCount: number;
  /**
   * Number of reminder email send attempts that failed.
   */
  failedCount: number;
  /**
   * The SharePoint site identifier received by the workflow.
   */
  siteId: string;
  /**
   * The SharePoint list identifier received by the workflow.
   */
  listId: string;
  /**
   * The sender mailbox received by the workflow.
   */
  senderMailbox: string;
  /**
   * The optional filter value received by the workflow.
   */
  filter?: string;
};

/**
 * Builds the placeholder values used to render email subject and body
 * templates for a specific invoice.
 *
 * @param item The invoice item currently being processed by the workflow.
 * @returns The token values available to the reminder template renderer.
 */
function buildReminderTemplateValues(
  item: InvoiceReminderItem,
): ReminderTemplateValues {
  const invoiceReference =
    item.InvoiceNumber ?? item.Id ?? "unknown invoice";

  return {
    ClientName: item.ClientName ?? "customer",
    InvoiceNumber: invoiceReference,
    InvoiceId: item.Id ?? invoiceReference,
    DueDate: item.DueDate ?? "the recorded due date",
  };
}

/**
 * Replaces supported reminder template placeholders with values from the
 * current invoice item.
 *
 * @param template The subject or body template to render.
 * @param values The placeholder values for the current invoice item.
 * @returns The rendered string with known placeholders replaced.
 */
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
 * Runs the overdue reminder workflow and returns a summary of the emails that
 * were matched, skipped, sent, or failed.
 *
 * @param deps The injected runtime dependencies used by the workflow.
 * @param input The request-specific workflow settings resolved by the function entrypoint.
 * @returns A workflow result describing the completed reminder processing run.
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

  // Acquiring a Microsoft Graph access token with the provided dependency function to authenticate downstream API calls for reading SharePoint items and sending emails.
  const graphAccessToken: string = await deps.getGraphAccessToken();
  deps.log("Acquired Graph access token", {
    tokenLength: graphAccessToken.length,
  });

  // Reading items from SharePoint that match the configured filter and mapping them into the workflow's invoice reminder model for processing.
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

  // Track each outcome separately so the caller can distinguish clean success
  // from partial failure without inspecting logs.
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // Looping through the matched SharePoint items sequentially to send reminder emails and track individual outcomes for each item.
  for (const [index, item] of getSPItemsResult.entries()) {
    deps.log(`Item ${index + 1}`, {
      id: item.Id,
      clientName: item.ClientName,
      dueDate: item.DueDate,
      recipientEmail: item.ClientEmail,
    });

    // An invoice cannot be emailed without a resolved recipient address, so the
    // workflow records it as skipped instead of failing the whole run.
    if (!item.ClientEmail) {
      skippedCount += 1;
      deps.log(`Skipping reminder email for item ${item.Id ?? index + 1}`, {
        reason: "Missing ClientEmail",
      });
      continue;
    }

    const templateValues = buildReminderTemplateValues(item);

    // Constructing the email parameters for the current invoice item to send a reminder email through Microsoft Graph.
    const emailArgs: SendEmailArgs = {
      graphAccessToken,
      senderMailbox: input.senderMailbox,
      recipientEmail: item.ClientEmail,
      subject: renderReminderTemplate(input.subjectTemplate, templateValues),
      bodyText: renderReminderTemplate(
        input.emailBodyTemplate,
        templateValues,
      ),
    };

    // Attempting to send the reminder email for the current item and updating the workflow outcome counts based on success or failure of the send operation.
    try {
      await deps.sendEmail(emailArgs);
      sentCount += 1;
      deps.log(
        `Successfully sent reminder email for item ${item.Id ?? index + 1}`,
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
  // Any send failure marks the run as partial success so the caller knows some
  // items may need manual review or a retry.
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

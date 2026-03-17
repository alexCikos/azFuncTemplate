import { extractErrorCode } from "../tools/errorHandlers";

/**
 * Data required to send a reminder email through Microsoft Graph.
 */
export type SendEmailArgs = {
  graphAccessToken: string;
  senderMailbox: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
};

/**
 * Structured send outcome returned to the workflow so item-level failures can
 * be logged without aborting the whole batch.
 */
export type Result = {
  isError: boolean;
  statusCode?: number;
  errorMessage?: string;
  errorCode?: string;
};

/**
 * Sends a reminder email through Microsoft Graph.
 *
 * Returns a structured result instead of throwing for expected send failures so
 * the workflow can continue processing other invoices.
 */
export async function sendEmail(args: SendEmailArgs): Promise<Result> {
  const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    args.senderMailbox,
  )}/sendMail`;

  let statusCode;

  try {
    const payload = {
      message: {
        subject: args.subject,
        body: {
          contentType: "Text",
          content: args.bodyText,
        },
        toRecipients: [
          {
            emailAddress: {
              address: args.recipientEmail,
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.graphAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    statusCode = response.status;

    // Graph queues the message asynchronously and reports acceptance with 202.
    if (response.status !== 202) {
      const errorBody = await response.text();
      return {
        isError: true,
        statusCode,
        errorMessage: `Graph sendMail failed (${response.status}) ${errorBody}`,
      };
    }

    return { isError: false, statusCode: statusCode };
  } catch (error) {
    // Email send failures are tracked per item, so this client returns a
    // structured result instead of throwing and aborting the whole batch.
    return {
      isError: true,
      errorMessage:
        error instanceof Error ? error.message : "Unknown email send error.",
      errorCode: extractErrorCode(error),
    };
  }
}

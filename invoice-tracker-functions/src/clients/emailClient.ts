import axios from "axios";
import {
  DEFAULT_DNS_RETRY_DELAY_MS,
  extractErrorCode,
  isRetryableDnsErrorCode,
} from "../tools/errorHandlers";

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
export type SendEmailResult = {
  isError: boolean;
  statusCode?: number;
  errorMessage?: string;
  errorCode?: string;
};

type GraphErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

const MAX_DNS_RETRY_ATTEMPTS = 3;
const DNS_RETRY_DELAY_MS = DEFAULT_DNS_RETRY_DELAY_MS;

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Sends a reminder email through Microsoft Graph.
 *
 * Returns a structured result instead of throwing for expected send failures so
 * the workflow can continue processing other invoices.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    args.senderMailbox,
  )}/sendMail`;

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

  for (let attempt = 1; attempt <= MAX_DNS_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${args.graphAccessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      // Graph queues the message asynchronously and reports acceptance with 202.
      if (response.status === 202) {
        return { isError: false, statusCode: response.status };
      }

      return {
        isError: true,
        statusCode: response.status,
        errorMessage: `Graph sendMail returned unexpected status ${response.status}.`,
      };
    } catch (error: unknown) {
      const errorCode = extractErrorCode(error);
      const isLastAttempt = attempt === MAX_DNS_RETRY_ATTEMPTS;
      const isRetryableDnsFailure = isRetryableDnsErrorCode(errorCode);

      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;

        if (typeof statusCode === "number") {
          const responseData = error.response?.data as GraphErrorPayload | undefined;
          const graphErrorCode = responseData?.error?.code;
          const graphErrorMessage = responseData?.error?.message;

          return {
            isError: true,
            statusCode,
            errorMessage: graphErrorMessage ?? error.message,
            errorCode: graphErrorCode ?? errorCode,
          };
        }

        if (isRetryableDnsFailure && !isLastAttempt) {
          await wait(DNS_RETRY_DELAY_MS);
          continue;
        }

        return {
          isError: true,
          errorMessage: error.message,
          errorCode,
        };
      }

      if (isRetryableDnsFailure && !isLastAttempt) {
        await wait(DNS_RETRY_DELAY_MS);
        continue;
      }

      return {
        isError: true,
        errorMessage:
          error instanceof Error ? error.message : "Unknown email send error.",
        errorCode,
      };
    }
  }

  return {
    isError: true,
    errorMessage: "Email send retry loop exited unexpectedly.",
  };
}

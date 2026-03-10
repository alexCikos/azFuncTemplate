/**
 * Utilities for sending email through the Microsoft Graph API.
 */

/**
 * Parameters required to send a plain-text email through Microsoft Graph.
 */
export type SendEmailArgs = {
  /**
   * App-only bearer token used to authorize the Graph `sendMail` request.
   */
  graphAccessToken: string;
  /**
   * Mailbox that will appear as the sender of the reminder email.
   */
  senderMailbox: string;
  /**
   * Recipient email address for the reminder message.
   */
  recipientEmail: string;
  /**
   * Subject line shown to the recipient.
   */
  subject: string;
  /**
   * Plain-text body content sent in the reminder email.
   */
  bodyText: string;
};

/**
 * Sends a plain-text email by calling the Microsoft Graph `sendMail` endpoint.
 *
 * @param args The email delivery settings, including the access token, sender mailbox, recipient, subject, and body text.
 * @returns A promise that resolves when Microsoft Graph accepts the email for delivery.
 */
export async function sendEmail(args: SendEmailArgs): Promise<void> {
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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.graphAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Graph `sendMail` accepts the request asynchronously and returns 202 when
  // the message has been queued successfully.
  if (response.status !== 202) {
    const errorBody = await response.text();
    throw new Error(
      `Graph sendMail failed (${response.status}) ${errorBody}`.trim(),
    );
  }
}

// emailClient.ts - Client for sending emails via Microsoft Graph API

// Object containing the necessary parameters to send an email, including the Graph access token, sender mailbox, recipient email, subject, and body text.
export type SendEmailArgs = {
  graphAccessToken: string;
  senderMailbox: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
};

// This function sends an email using the Microsoft Graph API. It constructs the appropriate API endpoint and payload based on the provided arguments, makes the HTTP request, and handles potential errors by checking the response status and throwing an error with details if the request was not successful.
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

  if (response.status !== 202) {
    const errorBody = await response.text();
    throw new Error(
      `Graph sendMail failed (${response.status}) ${errorBody}`.trim(),
    );
  }
}

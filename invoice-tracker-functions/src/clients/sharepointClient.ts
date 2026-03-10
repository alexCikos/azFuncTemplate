/**
 * Utilities for reading overdue invoice data from a SharePoint list by using
 * the Microsoft Graph API.
 */

import {
  mapInvoiceFields,
  type InvoiceReminderItem,
} from "../mapper/mapInvoiceFields";

/**
 * Minimal shape of a SharePoint list item returned by Graph for this workflow.
 */
type SharePointItem = {
  fields?: Record<string, unknown>;
};

/**
 * Reads SharePoint list items that match the supplied filter and maps their
 * raw fields to the invoice reminder model used by the app.
 *
 * @param graphAccessToken A valid Microsoft Graph access token with permission to read the SharePoint list.
 * @param filter The OData filter expression used to limit which SharePoint list items are returned.
 * Use SharePoint internal field names in this filter because the business-friendly field names are applied only after the Graph response is mapped.
 * @param siteId The ID of the SharePoint site containing the list.
 * @param listId The ID of the SharePoint list to read items from.
 * @returns A promise that resolves to cleaned invoice reminder records mapped from the SharePoint response.
 */
export async function getSharePointListItems(
  graphAccessToken: string,
  filter: string,
  siteId: string,
  listId: string,
): Promise<InvoiceReminderItem[]> {
  // Construct the Microsoft Graph API endpoint for reading items from a SharePoint list.
  const listEndpoint = new URL(
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(
      siteId,
    )}/lists/${encodeURIComponent(listId)}/items`,
  );

  // Expand raw SharePoint fields so they can be mapped after the Graph response is returned.
  listEndpoint.searchParams.set("$expand", "fields");
  if (filter) {
    listEndpoint.searchParams.set("$filter", filter);
  }

  // Microsoft Graph call: caller provides a valid app-only access token.
  const listResponse = await fetch(listEndpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${graphAccessToken}` },
  });

  // Parse the Graph response before error handling so detailed error fields are available in thrown messages.
  const listPayload = (await listResponse.json()) as {
    value?: SharePointItem[];
    error?: { code?: string; message?: string };
  };

  // If the response is not successful, throw an error with details from the Graph response to simplify troubleshooting.
  if (!listResponse.ok) {
    const graphCode = listPayload.error?.code ?? "unknown_graph_error";
    const graphMessage = listPayload.error?.message ?? "";
    // Surface status + Graph error details to simplify troubleshooting in logs.
    throw new Error(
      `Graph list read failed (${listResponse.status}) ${graphCode} ${graphMessage}`.trim(),
    );
  }

  // Map SharePoint internal keys (field_*) to readable business names. This also serves as a data validation step.
  const renamedFields = (listPayload.value ?? []).map((item) =>
    mapInvoiceFields(item.fields ?? {}),
  );

  // Return the cleaned + renamed list items to the caller, which will handle the business logic (e.g. sending reminder emails).
  return renamedFields;
}

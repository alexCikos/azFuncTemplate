import {
  mapInvoiceFields,
  type InvoiceReminderItem,
} from "../mapper/mapInvoiceFields";
import { extractErrorCode } from "../tools/errorHandlers";

type SharePointItem = {
  fields?: Record<string, unknown>;
};

/**
 * Reads matching SharePoint list items from Microsoft Graph and maps them into
 * the workflow's invoice model.
 *
 * Throws on request or Graph response failure because the workflow cannot
 * continue without the list data.
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

  // Graph returns list data under `fields`, so expand it before mapping.
  listEndpoint.searchParams.set("$expand", "fields");
  if (filter) {
    listEndpoint.searchParams.set("$filter", filter);
  }

  let listResponse: Response;
  try {
    listResponse = await fetch(listEndpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${graphAccessToken}` },
    });
  } catch (error) {
    // List reads gate the whole batch, so the workflow is simpler if this
    // helper throws and lets the outer handler stop the run.
    const errorCode = extractErrorCode(error);
    const message =
      error instanceof Error
        ? error.message
        : "Unknown SharePoint list read error.";
    throw new Error(
      `Graph list read failed${errorCode ? ` (${errorCode})` : ""} ${message}`.trim(),
    );
  }

  let listPayload:
    | {
        value?: SharePointItem[];
        error?: { code?: string; message?: string };
      }
    | undefined;

  try {
    listPayload = (await listResponse.json()) as {
      value?: SharePointItem[];
      error?: { code?: string; message?: string };
    };
  } catch {
    listPayload = undefined;
  }

  if (!listResponse.ok) {
    const graphCode = listPayload?.error?.code ?? "unknown_graph_error";
    const graphMessage =
      listPayload?.error?.message ?? "Unable to read SharePoint list items.";
    throw new Error(
      `Graph list read failed (${listResponse.status}) ${graphCode} ${graphMessage}`.trim(),
    );
  }

  const renamedFields = (listPayload?.value ?? []).map((item) =>
    mapInvoiceFields(item.fields ?? {}),
  );

  return renamedFields;
}

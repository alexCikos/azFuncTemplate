import axios from "axios";
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

  try {
    const listResponse = await axios.get<{
      value?: SharePointItem[];
    }>(listEndpoint.toString(), {
      headers: { Authorization: `Bearer ${graphAccessToken}` },
    });
    const renamedFields = (listResponse.data.value ?? []).map((item) =>
      mapInvoiceFields(item.fields ?? {}),
    );

    return renamedFields;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data as
        | { error?: { code?: string; message?: string } }
        | undefined;

      if (typeof statusCode === "number") {
        const graphCode = responseData?.error?.code ?? "unknown_graph_error";
        const graphMessage =
          responseData?.error?.message ?? "Unable to read SharePoint list items.";
        throw new Error(
          `Graph list read failed (${statusCode}) ${graphCode} ${graphMessage}`.trim(),
        );
      }
    }

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
}

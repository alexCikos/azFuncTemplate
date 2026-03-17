import { app } from "@azure/functions";
import {
  createReminderHandler,
  parseReminderHandlerRegistrations,
} from "./sendOverdueReminderEmails/createReminderHandler";
import reminderHandlerConfigs from "./sendOverdueReminderEmails/reminderHandlerConfigs.json";

const reminderRegistrations =
  parseReminderHandlerRegistrations(reminderHandlerConfigs);

for (const registration of reminderRegistrations) {
  app.http(registration.functionName, {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: createReminderHandler(
      registration.functionName,
      registration.definition,
    ),
  });
}

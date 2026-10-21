import { task } from "@trigger.dev/sdk";

// Throws on purpose to confirm task failures reach Sentry via trigger/init.ts.
// Run it from the Trigger.dev dashboard after a deploy.
export const sentryErrorTest = task({
  id: "sentry-error-test",
  retry: {
    maxAttempts: 1,
  },
  run: async () => {
    throw new Error("Test error from Trigger.dev task");
  },
});

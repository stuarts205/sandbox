import { tasks } from "@trigger.dev/sdk";
import * as Sentry from "@sentry/node";

// Loaded automatically before any task runs because it sits at the root of
// the trigger directory.
Sentry.init({
  // Trigger.dev owns the runtime's OpenTelemetry setup, so Sentry is used for
  // error reporting only (as in Trigger.dev's Sentry guide).
  defaultIntegrations: false,
  dsn: process.env.SENTRY_DSN,
  environment:
    process.env.NODE_ENV === "production" ? "production" : "development",
});

tasks.onFailure(({ payload, error, ctx }) => {
  Sentry.captureException(error, {
    tags: { runtime: "trigger.dev", task: ctx.task.id },
    extra: { payload, ctx },
  });
});

// Logs are buffered and sent on a timer, which a run that suspends or exits
// may never reach, so send whatever is buffered first.
tasks.onWait(async () => {
  await Sentry.flush(2000);
});

tasks.onComplete(async () => {
  await Sentry.flush(2000);
});

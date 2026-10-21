import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: "https://da7bc4b219a24cbd57580331fe57f625@o4506270958419968.ingest.us.sentry.io/4512295965949952",

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
})

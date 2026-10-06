// Paste your Google Cloud OAuth 2.0 "Web application" Client ID here.
// Example: 123456789012-abcdefg123456789.apps.googleusercontent.com
window.PFC_CONFIG = {
  GOOGLE_CLIENT_ID: "149746848833-7of4sno2qvhbaqajna9n11020bhqefao.apps.googleusercontent.com",
  DEPARTMENT: "PFC",
  TASK_HANDLED_BY: "IWS",
  DEFAULT_STATUS: "COMPLETED",

  // Extra Gmail search terms, if you want to narrow the search further.
  // Example: from:(person1@example.com OR person2@example.com)
  EXTRA_GMAIL_QUERY: "",

  // Gmail categories that are never imported as tasks.
  EXCLUDED_LABELS: [
    "CATEGORY_PROMOTIONS",
    "CATEGORY_SOCIAL",
    "CATEGORY_FORUMS"
  ]
};

# PFC Gmail Task Sheet Generator

A static GitHub Pages web app that reads a selected month's Gmail messages and creates an Excel PFC task sheet in the browser.

## What you get

- Month/year dropdowns
- Google Gmail OAuth sign-in
- Reads Gmail using `gmail.readonly`
- Searches only the selected month
- Extracts sender, date, subject/body
- Classifies task type using simple rules
- Generates `.xlsx` in the browser
- No backend and no database
- Gmail access token stays in the browser

## One-time Google setup

1. Open Google Cloud Console: https://console.cloud.google.com/
2. Create a project.
3. Enable **Gmail API**.
4. Configure the OAuth consent screen. For a personal/testing app, use External and add your own Gmail account as a test user if Google asks.
5. Create **OAuth Client ID → Web application**.
6. Add your GitHub Pages origin under **Authorized JavaScript origins**, for example:
   `https://YOUR-USERNAME.github.io`
   If the repository is a project site, the origin is still only `https://YOUR-USERNAME.github.io`.
7. Copy the Web Client ID.
8. Put it in `config.js`:

```js
window.PFC_CONFIG = {
  GOOGLE_CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",
  DEPARTMENT: "PFC",
  TASK_HANDLED_BY: "IWS",
  DEFAULT_STATUS: "COMPLETED",
  EXTRA_GMAIL_QUERY: ""
};
```

Do not put a client secret in this project. A browser app uses the OAuth Web Client ID and Google's token flow.

## Publish to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this folder.
3. Commit/push.
4. Repository → Settings → Pages → Deploy from branch → `main` → `/root` → Save.
5. Open the generated GitHub Pages URL.
6. Select month/year → **Generate Excel** → sign in with Gmail → allow read-only Gmail access.

## Important

This project intentionally requests only `https://www.googleapis.com/auth/gmail.readonly`. It does not send, delete, or modify email.

The app reads the subject and body because the task description and task type may need the email content. Everything is processed client-side.

The default task rules are intentionally simple. Edit `classify()` and `cleanTask()` in `app.js` to match your organization's exact email wording.

## Current Excel columns

1. Sl.No
2. TASK
3. Requirement By
4. Department
5. Task Date
6. Status
7. Completion Date
8. Task Handled By
9. Task Type

# PFC Gmail Task Sheet Generator

A browser-only GitHub Pages app that reads a selected month's Gmail work emails and creates an Excel PFC task sheet.

## What it does

- Select month and year.
- Sign in with Google using Gmail OAuth.
- Searches only the selected month.
- Excludes Gmail Promotions, Social and Forums categories.
- Keeps Updates because genuine work mail can be placed there by Gmail.
- Handles forwarded work emails by trying to extract the original `From:` and `Subject:` from the forwarded content.
- Uses the mailbox email date as the task date.
- Classifies tasks as `ERROR RECTIFICATION`, `DEVELOPMENT`, or `MODIFICATION` using simple rules.
- Generates `.xlsx` directly in the browser.
- No backend/database.

## Setup

1. Enable Gmail API in Google Cloud.
2. Configure OAuth branding/audience.
3. Create a **Web application** OAuth client.
4. Add your GitHub Pages origin under **Authorized JavaScript origins**, e.g. `https://YOUR-USERNAME.github.io`.
5. Put the Web Client ID in `config.js`.
6. Add your Google account as a test user if the OAuth app is in Testing.
7. Publish the repository with GitHub Pages.

## Optional filtering

`config.js` contains `EXTRA_GMAIL_QUERY` if you later want to restrict by sender, subject, etc. Example:

```js
EXTRA_GMAIL_QUERY: 'from:(person1@example.com OR person2@example.com)'
```

Do not put a Google client secret in this repository.

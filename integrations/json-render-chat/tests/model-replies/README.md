Replies a model wrote for eight requests, from the system prompt `server/chat.ts` builds: `before/` with json-render's
rules alone, `after/` with the rules in the catalog's `rules`. `tests/model-replies.test.tsx` streams each one through
the server's transform and checks the screen it builds.

| File | Request |
| --- | --- |
| `1-inbox.txt` | What's in my inbox? |
| `2-settings.txt` | Show my notification settings |
| `3-signup.txt` | Help me sign up |
| `4-lisbon.txt` | Plan a weekend in Lisbon with stops I can tick off |
| `5-laptops.txt` | Compare three laptop options under $1500 |
| `6-booking.txt` | Book a table for 4 on Friday |
| `7-tasks.txt` | Show my tasks for today and let me mark them done |
| `8-password.txt` | I want to change my password |

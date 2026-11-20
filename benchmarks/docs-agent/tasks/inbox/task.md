This folder holds a new Vite app, made with `npm create vite` and the `react-ts` template, with its packages installed.

Build an inbox screen in it with the Lede design system. Lede's documentation starts at {{DOCS}}/llms.txt. Fetch it and any page it links to with `curl`.

The messages are in `src/data/inbox.json`. The screen lists them, each showing its sender, subject, the start of its body and its date, with unread ones marked. Choosing a message shows the whole message beside the list on a wide screen, and on its own on a phone. Use Lede's components and blocks wherever Lede has one for the job, and follow its install steps.

You're done when `npm run build` passes and the app shows the inbox at its root URL. Then reply with one line that says what you built.

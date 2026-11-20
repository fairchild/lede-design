This folder holds a new Vite app, made with `npm create vite` and the `react-ts` template, with its packages installed.

Build an account preferences screen in it with the Lede design system. Lede's documentation starts at {{DOCS}}/llms.txt. Fetch it and any page it links to with `curl`.

The starting values are in `src/data/preferences.json`. The screen lets someone edit their name and email, turn each notification on or off, and choose a theme: light, dark or the same as the system. A Save button saves the changes and then says "Saved". Each field and switch is labelled with the name in the data. Use Lede's components and blocks wherever Lede has one for the job, and follow its install steps.

You're done when `npm run build` passes and the app shows the screen at its root URL. Then reply with one line that says what you built.

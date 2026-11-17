This folder holds a new Vite app, made with `npm create vite` and the `react-ts` template, with its packages installed.

Build a server list screen in it with the Lede design system. Lede's documentation starts at {{DOCS}}/llms.txt. Fetch it and any page it links to with `curl`.

The servers are in `src/data/servers.json`. The screen shows them in a table with Name, Region, Status and CPU columns. A search box filters the rows by name, and the Name column can be sorted. Use Lede's components and blocks wherever Lede has one for the job, and follow its install steps.

You're done when `npm run build` passes and the app shows the table at its root URL. Then reply with one line that says what you built.

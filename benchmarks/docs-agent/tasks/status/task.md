This folder holds a new Vite app, made with `npm create vite` and the `react-ts` template, with its packages installed.

Build a service status page in it with the Lede design system. Lede's documentation starts at {{DOCS}}/llms.txt. Fetch it and any page it links to with `curl`.

The services and incidents are in `src/data/status.json`. At the top, the page says how many services are operational, degraded and down. Below that it lists every service with its status in words and its 90-day uptime, then the open incidents with their state. Use Lede's components and blocks wherever Lede has one for the job, and follow its install steps.

You're done when `npm run build` passes and the app shows the page at its root URL. Then reply with one line that says what you built.

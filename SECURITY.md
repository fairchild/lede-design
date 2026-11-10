# Security

Report a vulnerability privately through GitHub: on the repository's **Security** tab, choose **Report a
vulnerability**. Please don't open a public issue for it.

Fixes go to the latest release. A release's registry files never change, so a fix ships as a new version, and its
CHANGELOG entry says which earlier versions are affected and how to upgrade.

Lede's code is copied into your project when you install it. To take a fix, point `components.json` at the fixed
release's registry URL and run the same `npx shadcn@latest add` with `-o`, as the README describes.

# Lede's registry, mirrored

Each folder under `r/` is a release of Lede's shadcn registry, copied byte for byte from
`https://lede.cloudcompute.com/r/<release>/` by `.github/workflows/mirror-registry.yml` on `main`. A release's
files never change. Use it where Lede's site is out of reach but GitHub isn't, such as in a sandbox:

```bash
npx shadcn@latest registry add '@lede=https://raw.githubusercontent.com/fairchild/lede-design/registry/r/v0.7.0/{name}.json'
```

Change the release in the URL to the one you want. The install steps are in the README on `main`.

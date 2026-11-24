# Crafty Corner

An online store with an owner dashboard for **Crafty Corner**, a handmade home-decor brand.
Arabic first (RTL) with English available. Built on **Angular 21**, **.NET 10** and **MySQL**.

Orders are placed on the site (cart and checkout, cash on delivery). The owner manages products and orders from a dashboard.

> Status: storefront and **owner dashboard** are running locally with **sample products**. Real products and
> deployment are the next steps (see the roadmap).

## Brand

Colors, fonts and shapes are frozen in [design/BRAND.md](design/BRAND.md). The design tokens live in
`web/src/styles.css` (Tailwind v4 `@theme`).

## Roadmap

- [x] Phase 1: visual identity
- [x] Phase 2: new project and storefront theme, sample catalogue
- [x] Phase 3: owner dashboard (products with photo upload, orders with a status workflow, messages, stats)
- [ ] Phase 4: deployment, domain and an owner guide

## Owner dashboard

Signed-in admins get a **Dashboard** button in the store header that opens the dashboard app:

- **Home**: new orders waiting, today, open order value, orders per status, last 7 days, products running low.
- **Orders**: New, Confirmed, Preparing, Shipped, Delivered (or Cancelled, which puts the items back in stock exactly once).
  Customers can still cancel on their own until the order is confirmed. Call or WhatsApp the customer from the order page.
- **Products**: add, edit, hide; photos are uploaded from the device (JPG/PNG/WebP up to 5 MB, checked by content, not by name).
- **Messages**: what customers sent from the Contact page, with reply links.

Create the first admin by setting both of these (nothing is created otherwise):

```bash
dotnet user-secrets set "Seed:AdminEmail" "owner@example.com" --project api
dotnet user-secrets set "Seed:AdminPassword" "<a strong password>" --project api
```

Uploaded photos live in `Uploads:Path` (default `api/uploads`; `/data/uploads` in Docker). **Mount a volume there on the host**,
otherwise photos disappear on every redeploy (or swap `UploadsController` for an image service such as Cloudinary).

## Run it locally

Prerequisites: **.NET 10 SDK**, **Node.js 22+**, **MySQL 8**.

```bash
dotnet tool restore

# secrets stay outside git
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Database=crafty_corner;User=root;Password=..." --project api
dotnet user-secrets set "Jwt:Key" "<at least 32 random characters>" --project api

dotnet ef database update --project api
dotnet run --project api            # Development seeds the sample catalogue (http://localhost:5034)

cd web && npm install
npm start                           # the store, http://localhost:4200
npm run start:admin                 # the owner dashboard, http://localhost:4201
```

Or start all three at once on Windows with `.\dev.ps1`.

## Two apps, one API

`web/` is an Angular workspace with two separate applications talking to the same API and database:

| App | Folder | Dev URL |
| --- | --- | --- |
| Store (customers) | `web/src` | http://localhost:4200 |
| Owner dashboard | `web/projects/admin` | http://localhost:4201 |

The dashboard has its own sign-in page (owner accounts only) and the store has no dashboard code at all; the
header just links to it (`adminUrl` in `web/src/environments`). Models, auth, i18n and the theme are shared:
the dashboard imports them from the store's `src/app` through the `@web/*` alias. In development both apps are
on `localhost`, so the browser shares the sign-in cookie between them.

Deployment of the dashboard (own domain, subdomain or a path) is still undecided, so the Docker image
currently serves the store only.

Everything else (email, Docker, deployment, tests) works as in the project this was started from:
see [docs/DEPLOY.md](docs/DEPLOY.md) and `.env.example`.

## Notes

- The catalogue shipped in `api/Data/SeedCatalog.cs` is **sample data** (names, prices, stock are placeholders;
  photos are reference images). The owner replaces it from the dashboard.
- Shop details (phone, email, address, hours) live in `web/src/app/core/site.ts`; empty fields are hidden.

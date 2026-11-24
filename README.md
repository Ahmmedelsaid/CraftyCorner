# Crafty Corner

An online store (with an owner dashboard on the way) for **Crafty Corner**, a handmade home-decor brand.
Arabic first (RTL) with English available. Built on **Angular 21**, **.NET 10** and **MySQL**.

Orders are placed on the site (cart and checkout, cash on delivery). The owner manages products and orders from a dashboard.

> Status: storefront re-themed and running with **sample products**. The admin dashboard, real products and
> deployment are the next steps (see the roadmap).

## Brand

Colors, fonts and shapes are frozen in [design/BRAND.md](design/BRAND.md). The design tokens live in
`web/src/styles.css` (Tailwind v4 `@theme`).

## Roadmap

- [x] Phase 1: visual identity
- [x] Phase 2: new project and storefront theme, sample catalogue
- [ ] Phase 3: owner dashboard (login, products with image upload, order management with statuses, simple stats)
- [ ] Phase 4: deployment, domain and an owner guide

## Run it locally

Prerequisites: **.NET 10 SDK**, **Node.js 22+**, **MySQL 8**.

```bash
dotnet tool restore

# secrets stay outside git
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Database=crafty_corner;User=root;Password=..." --project api
dotnet user-secrets set "Jwt:Key" "<at least 32 random characters>" --project api

dotnet ef database update --project api
dotnet run --project api            # Development seeds the sample catalogue (http://localhost:5034)

cd web && npm install && npm start  # http://localhost:4200
```

Everything else (email, Docker, deployment, tests) works as in the project this was started from:
see [docs/DEPLOY.md](docs/DEPLOY.md) and `.env.example`.

## Notes

- The catalogue shipped in `api/Data/SeedCatalog.cs` is **sample data** (names, prices, stock are placeholders;
  photos are reference images). The owner replaces it from the dashboard.
- Shop details (phone, email, address, hours) live in `web/src/app/core/site.ts`; empty fields are hidden.

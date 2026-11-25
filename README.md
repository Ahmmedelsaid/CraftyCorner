# Crafty Corner

An online store with an owner dashboard for **Crafty Corner**, a handmade home-decor brand.
Arabic first (RTL) with English available. Built on **Angular 21**, **.NET 10** and **MySQL**.

Orders are placed on the site (cart and checkout, cash on delivery). The owner manages products and orders from a dashboard.

> Status: storefront and **owner dashboard** are running locally with **sample products**. Real products and
> deployment are the next steps (see the roadmap).

## Brand

Colors, fonts and shapes are frozen in [design/BRAND.md](design/BRAND.md). The design tokens live in
`shared/styles.css` (Tailwind v4 `@theme`).

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

npm install
npm start                           # the store, http://localhost:4200
npm run start:admin                 # the owner dashboard, http://localhost:4201
```

Or start all three at once on Windows with `.\dev.ps1`.

## Two apps, one API

```
api/        the .NET API (one API, one MySQL database)
customer/   the store, Angular app, http://localhost:4200
admin/      the owner dashboard, Angular app, http://localhost:4201
shared/     code both apps use: auth, API models, i18n, theme (styles.css), environments, public assets
```

The repo root is one Angular workspace (`angular.json`, `package.json`, one `node_modules`) with two separate
applications, `customer` and `admin`. Both import the shared code through the `@shared/*` alias.

The dashboard has its own sign-in page (owner accounts only) and the store has no dashboard code at all; the
header just links to it (`adminUrl` in `shared/environments`). Each app keeps its own sign-in cookie
(the API picks it from the `X-Client-App` header), so being signed in as a customer on :4200 and as the owner
on :4201 at the same time works.

Deployment of the dashboard (own domain, subdomain or a path) is still undecided, so the Docker image
currently serves the store only.

Everything else (email, Docker, deployment, tests) works as in the project this was started from:
see [docs/DEPLOY.md](docs/DEPLOY.md) and `.env.example`.

## Notes

- The catalogue shipped in `api/Data/SeedCatalog.cs` is **sample data** (names, prices, stock are placeholders;
  photos are reference images). The owner replaces it from the dashboard.
- Shop details (phone, email, address, hours) live in `customer/src/app/core/site.ts`; empty fields are hidden.

## New-order alerts (on your phone)

Two independent channels. Use either, or both: one failing never stops the order.

- **Telegram** (instant, free). In Telegram, talk to `@BotFather`, send `/newbot` and keep the token it gives you. Open a chat with your new bot and send it any message, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the number in `"chat":{"id":...}`. Then set:

  ```
  dotnet user-secrets set "Notifications:Telegram:BotToken" "<TOKEN>" --project api
  dotnet user-secrets set "Notifications:Telegram:ChatId" "<CHAT ID>" --project api
  dotnet user-secrets set "Notifications:AdminUrl" "https://your-dashboard-address" --project api   # optional: adds an "Open" link
  ```

  On a host use the environment variables `Notifications__Telegram__BotToken`, `Notifications__Telegram__ChatId` and `Notifications__AdminUrl`. The message has the customer, phone, address, items, total and a map link, and a second one tells you when a customer cancels.
- **Email** (the full details, and you can reply to the customer). Set `Email:Host` (`smtp.gmail.com`), `Email:UserName`, `Email:Password` and `Email:OrderRecipient`. For Gmail the password must be an **App Password** (turn on 2-step verification, then create one at myaccount.google.com/apppasswords), never your normal password.

## Paying by InstaPay

Customers can choose InstaPay at the checkout: they send the order total to the shop's InstaPay account, then upload a screenshot of the transfer. The owner sees the screenshot on the order page and presses **Confirm payment** (or **Reject** with a reason, and the customer uploads a new one). An InstaPay order cannot move past "New order" until the payment is confirmed.

The option stays hidden until the shop sets its account:

```
dotnet user-secrets set "Shop:InstaPay:Handle" "yourshop@instapay" --project api
dotnet user-secrets set "Shop:InstaPay:PhoneNumber" "01012345678" --project api   # optional
dotnet user-secrets set "Shop:InstaPay:AccountName" "Crafty Corner" --project api   # what the customer sees in the InstaPay app
```

(or the environment variables `Shop__InstaPay__Handle`, `Shop__InstaPay__PhoneNumber`, `Shop__InstaPay__AccountName`.) Screenshots are private: they are stored in the `receipts` folder (`Receipts:Path` to move it; on a host it must be a persistent volume, like `uploads`), never served as static files, and only the customer and the owner can open them. There is no automatic check of the transfer: InstaPay has no public API for shops, so the owner compares the screenshot with the InstaPay app.

## Delivery fee

Every order carries a delivery fee, 100 EGP for now. Change it with `Shop:ShippingFee` (appsettings, user-secrets, or the environment variable `Shop__ShippingFee`; `0` means free delivery). The fee is copied onto each order when it is placed, so changing it never changes old orders. The cart, the checkout, the order pages, the emails and the Telegram alert all show it.

## Tests

- `dotnet test api.tests`: API tests (xunit). Unit-style tests of the controllers plus end-to-end HTTP tests that start the real app in memory on SQLite.
- `npx ng test`: Angular specs (CI is the reference on Windows, where the runner can hang).
- `npm run test:e2e`: Playwright, in a real browser. It covers the shop, the delivery map, the phone layout, and the owner dashboard (including its phone layout).
  It needs the site and the API running, and Chrome installed.
  - With the dev servers: `E2E_BASE_URL=http://localhost:4200 E2E_API_URL=http://localhost:5034/api`, plus `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for the dashboard tests (they are skipped without them). Set `E2E_START_ADMIN=1` to let Playwright start the dashboard on port 4201.
  - **No MySQL?** `E2E_HOST=1 dotnet test api.tests --filter E2EHost` runs a throwaway copy of the API on port 5034 (SQLite, demo catalogue, admin `e2e-admin@example.com` / `Passw0rd!1`) and leaves your database alone. The tests create customers, orders and products with `e2e-` / `E2E` names, so run them against a throwaway database, not the one you use for real data.
  - CI runs everything against the Docker image and MySQL.

## Before going live (security)

- Set `AllowedHosts` (env `AllowedHosts`, or `ALLOWED_HOSTS` in Docker) to the real domain. It is `localhost` by default, so a deployed site answers 400 until it is set.
- Use a long random `Jwt__Key` and a strong admin password, never `admin123`. Keep secrets in user-secrets or environment variables.
- Serve everything over HTTPS (HSTS is on outside Development), and put the dashboard on a subdomain of the same site so the Strict refresh cookie works.
- The API sends security headers on every response, locks an account for 15 minutes after 5 wrong passwords, and rejects the token of a deactivated account at once.

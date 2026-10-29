# My Recipes

A self-hosted recipe book web app for keeping, browsing and searching family recipes. It runs on a Raspberry Pi behind nginx and is served at `/myrecipes/`.

## What it does

- **Browse by category.** Recipes are filed into a nested category tree (for example *Breads → Quick Breads → Fruit Breads*). You can drill down with breadcrumbs, see recipe counts on each tile, and page through results. The current category and page are kept in the URL, so the Back button and shared links work.
- **Search.** Results update as you type and match recipe names, keywords and ingredients. Press `/` anywhere to jump to the search box.
- **View a recipe.** Each recipe page shows its description, author, servings, prep and cook times, ingredients and numbered steps. Quantities display as kitchen fractions (`1 1/2 cups`, not `1.500`), and unit names switch between singular and plural.
- **Photos.** Each recipe can have up to 20 photos. You can reorder them and add alt text. Uploads are auto-rotated, resized to fit 1600px and saved as WebP.
- **Add, edit and delete recipes** through a single form covering details, ingredients (with optional items), steps and photos.
- **Print / Save as PDF.** Recipe pages have a print layout, and the PDF file name defaults to the recipe name.
- **Site maintenance.** An admin page for managing measurement units and the category tree. Units and categories that are still in use can't be deleted.
- **Light and dark themes** that follow the device setting. The layout works on phones.

## Technologies

| Layer | Stack |
| --- | --- |
| Frontend | [React 19](https://react.dev) single-page app, [React Router 7](https://reactrouter.com) for client-side routing, CSS Modules for styling |
| Build tooling | [Vite 7](https://vite.dev), ESLint |
| API | [Node.js](https://nodejs.org) + [Express 4](https://expressjs.com) REST API (`server/server.js`) |
| Database | [PostgreSQL](https://www.postgresql.org), accessed with `pg` (connection pool) and `pg-format` |
| Image handling | `multer` for multipart uploads, [`sharp`](https://sharp.pixelplumbing.com) for resizing and WebP conversion |
| Hosting | nginx serves the built static files and reverse-proxies `/myrecipes/api/` to the Node API, which runs as a systemd service |

### How the pieces fit together

```
Browser ──► nginx :80
              ├─ /myrecipes/        → static files from dist/  (React build)
              └─ /myrecipes/api/    → proxy to 127.0.0.1:4002/api/  (Express)
                                          ├─ PostgreSQL (schema "myrecipes")
                                          └─ images/  (recipe photos on disk)
```

The site and the API share one origin, so the API needs no CORS setup and listens only on `127.0.0.1`. Photos are stored on disk in `images/`, outside the build and git. The API serves them at `/myrecipes/api/images/<file>` with long-lived cache headers.

## Project layout

```
├── index.html            Vite entry HTML
├── vite.config.js        base path is /myrecipes/
├── src/
│   ├── main.jsx          React root + router
│   ├── App.jsx           Route definitions
│   ├── api.js            All fetch calls to the API
│   ├── format.js         Display helpers (times, fractions)
│   ├── pages/            Home (browse/search), Recipes (recipe view)
│   ├── components/       Header, category browser, search, add/edit form, maintenance tools
│   └── css/              CSS Modules
├── server/
│   ├── server.js         Express API
│   └── sample.env        Template for server/.env
└── images/               Uploaded recipe photos (git-ignored)
```

## Database

The API expects a PostgreSQL schema (`myrecipes` by default) with these tables. The schema DDL isn't included in this repo.

| Table | Purpose |
| --- | --- |
| `recipes` | name, description, author, servings, prep/cook time (minutes), keywords, `category_code` |
| `recipe_ingredients` | `recipe_id`, description, quantity, `unit_id`, ranking (order), optional flag |
| `recipe_steps` | `recipe_id`, description, ranking (order) |
| `recipe_images` | `recipe_id`, `url` (`images/<file>`), alt text, sort order |
| `categories` | `code`, `parent_code`, title, description; a self-referencing tree with a root `All` category |
| `units` | name (e.g. `tsp`), description (e.g. `Teaspoon(s)`) |

## Deployment

These steps match the current Raspberry Pi setup (Debian-based Linux, nginx, systemd). Adjust paths and users to fit your machine.

### 1. Prerequisites

- Node.js 20.11+ and npm (the API uses `import.meta.dirname`)
- PostgreSQL, with a database, a user, and the `myrecipes` schema and tables above
- nginx

### 2. Get the code and install dependencies

```bash
cd /var/www
git clone git@github.com:nlgatewood/myRecipesApp.git myrecipesapp
cd myrecipesapp
npm install                 # frontend
npm --prefix server install # API
```

### 3. Configure the API

```bash
cp server/sample.env server/.env
```

Edit `server/.env`:

```ini
PORT=4002
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=<database>
PGUSER=<user>
PGPASSWORD=<password>
PGSCHEMA=myrecipes
NODE_ENV=production
# IMAGE_DIR=/path/to/images   # optional; defaults to ../images
```

The service user needs write access to the `images/` directory.

### 4. Build the frontend

```bash
npm run build
```

This writes the static site to `dist/`. The build uses the `/myrecipes/` base path set in `vite.config.js`. Change it there if you host the app at a different path.

### 5. Run the API as a systemd service

Create `/etc/systemd/system/myrecipes.service`:

```ini
[Unit]
Description=myrecipes API
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/myrecipesapp/server
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Restart=always
User=<user>
Group=<group>

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now myrecipes.service
curl http://127.0.0.1:4002/api/health   # {"ok":true} when the API can reach the database
```

### 6. Configure nginx

Add these blocks to your site's `server { … }` block (on the Pi this is `/etc/nginx/sites-available/mylocalapps`, symlinked into `sites-enabled`):

```nginx
# redirect no-slash → with-slash
location = /myrecipes { return 301 /myrecipes/; }

# Recipes static
location /myrecipes/ {
    alias /var/www/myrecipesapp/dist/;
    index index.html;
    try_files $uri $uri/ /myrecipes/index.html;   # SPA fallback for client-side routes
}

# Recipes API
location /myrecipes/api/ {
    client_max_body_size 100M;   # recipe photo uploads
    proxy_pass http://127.0.0.1:4002/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

The site is now at `http://<host>/myrecipes/`.

### Updating a running deployment

```bash
cd /var/www/myrecipesapp
git pull
npm install && npm run build                 # frontend changes
npm --prefix server install
sudo systemctl restart myrecipes.service     # API changes
```

## Local development

```bash
npm run dev     # Vite dev server with hot reload
npm run lint    # ESLint
npm run preview # serve the production build locally
```

The frontend calls the API at `<base>/api/`. To develop against a local API, start it with `npm --prefix server start` and add a `server.proxy` entry for `/myrecipes/api` → `http://127.0.0.1:4002` in `vite.config.js`. Without a proxy, the frontend has no API to call.

## Security note

The app has no authentication: anyone who can reach the site can add, edit and delete recipes. It's meant for a trusted home network. Put it behind a VPN or add an auth layer in nginx before exposing it to the internet.

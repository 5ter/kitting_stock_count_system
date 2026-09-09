# Warehouse Label Project

## Overview

This repository contains a Node.js + Express web application for generating, previewing, printing, and tracking warehouse shelf labels. The system is designed for local network printer integration, batch-based job processing, and persistent history tracking via SQLite.

The application is structured as a multi-page Express app with the following functional areas:

- Generate label batches from user input
- Preview labels before printing
- Print label batches through a sequential queue
- Cancel or resume active batches
- View print history grouped by date
- Configure printer connection settings and batch limits
- Deploy via PM2 and GitHub Actions on a self-hosted Windows runner

## Architecture

```text
Browser
  │
  ▼
Express app (routes + views)
  │
  ├─ buildLabel() -> generates label data from form input
  ├─ db.js -> SQLite schema + batch/label persistence
  ├─ services/printQueue.js -> sequential printing workflow
  ├─ printer/print-service.js -> printer TCP communication and status checks
  └─ routes/settings.js -> .env updates and settings UI
```

## Runtime Stack

- Node.js: 24.19.0
- Express.js
- Jade/Pug templates
- SQLite (`node:sqlite`)
- HTMX for partial-page updates
- Tailwind CSS for styling
- PM2 for production process management
- GitHub Actions for CI/CD automation

## Application Flow

### 1. Form submission and label generation

The main route in `routes/index.js` accepts a form submission, then:

1. Calls `buildLabel(form)` from `services/buildLabel.js`
2. Validates the generated label count against `MAX_LABELS_PER_BATCH`
3. Creates a batch record in SQLite via `db.createBatch(...)`
4. Inserts all generated labels into the `labels` table
5. Starts `processBatch(batchId)` asynchronously

### 2. Print queue execution

The queue logic lives in `services/printQueue.js`.

Responsibilities:

- enforce single active processing per batch
- prevent duplicate processing jobs
- track cancel requests
- process labels one by one in sequence
- mark individual labels as `completed`, `failed`, or `printing`
- pause a batch when a printer error is encountered
- allow the batch to resume later by re-invoking `processBatch(batchId)`

### 3. Printer communication

The file `printer/print-service.js` provides printer I/O:

- `sendAndCheckStatus(sbplData, ip, port, opts)` sends SBPL content to the printer
- checks printer ACK/ENQ status response
- returns success/failure information for the queue
- exposes `testConnection()` for the Settings page

### 4. Status and history tracking

The database layer in `db.js` stores and retrieves:

- batch metadata (`batches` table)
- per-label print status (`labels` table)
- batch totals and completed counts
- error messages for failed labels
- history grouped by date

## Repository Layout

```text
.
├── app.js                     # Express app bootstrap
├── bin/
│   └── www                   # HTTP server entry point
├── data/
│   └── labels.db             # SQLite database file
├── middleware/
│   └── validateLabelForm.js # Server-side label input validation
├── printer/
│   ├── generate-label.js     # SBPL label generation helper
│   └── print-service.js      # Printer TCP / status checks
├── public/
│   ├── images/
│   ├── javascripts/
│   └── stylesheets/
├── routes/
│   ├── department.js
│   ├── history.js
│   ├── index.js              # Main generate/preview endpoints
│   ├── settings.js           # Settings and .env management
│   └── users.js
├── services/
│   ├── buildLabel.js         # Label expansion logic
│   ├── calcLabelCount.js     # Counting and range expansion helpers
│   ├── printQueue.js         # Batch processing + cancellation logic
│   └── time.js               # Timestamp utilities
├── styles/
│   └── tailwind.css
├── views/
│   ├── error.jade
│   ├── history.jade
│   ├── index.jade
│   ├── layout.jade
│   ├── mixins/
│   └── partials/
├── .github/
│   └── workflows/
│       ├── ci.yml            # CI validation workflow
│       └── deploy.yml        # Self-hosted deployment workflow
├── .env.example              # Example environment file
├── .gitignore
├── bs-config.js             # BrowserSync config
├── db.js                    # SQLite schema + helper functions
├── ecosystem.config.js      # PM2 app definition
├── nodemon.json
├── package.json             # Scripts and dependencies
├── tailwind.config.js
├── README.md
└── package-lock.json
```

## Database Schema

The application automatically creates the following tables at startup in `db.js`:

### `batches`

Columns:

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `plant`
- `location_type`
- `shelf_prefix`
- `shelf_start`
- `shelf_end`
- `partition_start`
- `partition_end`
- `arrow`
- `status`
- `total_count`
- `created_at`

### `labels`

Columns:

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `batch_id`
- `sequence_no`
- `location_code`
- `sbpl`
- `status`
- `error_message`
- `printed_at`

### Notes

- `labels` has a composite uniqueness rule on `(batch_id, sequence_no)`.
- `getNextLabelToPrint()` prefers failed labels first so a resume picks up the interrupted label before pending ones.
- `getHistory()` builds grouped history data by date for the History page.

## Environment Variables

The application uses `.env` values loaded by `dotenv` in `app.js`.

Current variables used by the project:

```env
PRINTER_IP=192.168.40.29
PRINTER_PORT=9100
PORT=3000
NODE_ENV=production
MAX_LABELS_PER_BATCH=0
```

### Variable behavior

- `PRINTER_IP`: target printer IP for print requests
- `PRINTER_PORT`: TCP port used by the printer service
- `PORT`: Express listening port
- `NODE_ENV`: runtime mode
- `MAX_LABELS_PER_BATCH`: optional maximum number of generated labels per batch

## Server Startup

The app startup entry point is:

- `bin/www`

This file:

1. requires `../app`
2. reads `process.env.PORT`
3. sets the Express app port
4. creates an HTTP server
5. starts listening on the configured port

### Startup command

```bash
npm start
```

This resolves to:

```bash
node --env-file=.env ./bin/www
```

## Scripts

### `npm run check`

Validates the JavaScript files with `node --check` for:

- `app.js`
- `db.js`
- `routes/index.js`
- `routes/history.js`
- `routes/settings.js`
- `services/printQueue.js`
- `printer/print-service.js`
- `middleware/validateLabelForm.js`

### `npm run build:css`

Runs Tailwind CLI to rebuild the final stylesheet into:

```text
public/stylesheets/style.css
```

### `npm run dev`

Runs the development workflow using:

- `watch:server`
- `watch:css`
- `watch:browser`

This is useful for local development while editing templates and styles.

## Routes and Handler Responsibilities

### `routes/index.js`

Main route file for all generate/preview operations.

Responsibilities:

- render the Generate page
- generate preview HTML via HTMX partials
- validate the incoming form
- create and start a batch
- expose batch status endpoints
- expose cancel/resume actions

#### Key endpoints

```text
GET    /
POST   /labels/preview
POST   /labels/generate
GET    /labels/batches/:batchId
POST   /labels/batches/:batchId/cancel
POST   /labels/batches/:batchId/resume
```

### `routes/history.js`

Renders the History page and formats history rows for the UI.

Responsibilities:

- query `db.getHistory()`
- transform timestamps for date/time display
- group data by date for the view

### `routes/settings.js`

Manages Settings UI and server-side configuration persistence.

Responsibilities:

- read current environment values
- update `.env` variables for `PRINTER_IP` and `PRINTER_PORT`
- save application settings such as `MAX_LABELS_PER_BATCH`
- test printer connectivity
- export history as JSON
- clear batch history

## Print Queue Logic

The queue implementation uses two in-memory sets:

- `activeBatches`: prevents duplicate concurrent processing of the same batch
- `cancellationRequests`: tracks the user-requested stop signal

### Batch states

Batch state can be one of:

- `pending`
- `processing`
- `paused`
- `cancelled`
- `completed`

### Label states

Individual label states can be:

- `pending`
- `printing`
- `completed`
- `failed`
- `cancelled`

### Resume behavior

The system intentionally reprocesses failed labels first:

- `getNextLabelToPrint(batchId)` prioritizes `failed` labels over `pending` labels
- this allows `resume` to continue exactly from the failed print point

## PM2 Configuration

The project includes `ecosystem.config.js` for PM2 deployment conventions.

Current app definition:

```js
module.exports = {
  apps: [
    {
      name: 'warehouse-label',
      script: './bin/www',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      node_args: ['--env-file=.env'],
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

### First-time PM2 setup

```bash
npm ci
npm run build:css
pm2 start ecosystem.config.js
pm2 save
```

### Later updates

```bash
pm2 restart ecosystem.config.js --update-env
pm2 save
```

### PM2 command reference

```bash
pm2 list
pm2 monit
pm2 restart warehouse-label
pm2 stop all
pm2 kill
```

## CI/CD Workflow Details

### CI: `.github/workflows/ci.yml`

Triggered on:

- `push` to `main`
- `pull_request`

Validation steps:

1. Checkout repository
2. Setup Node.js 24
3. `npm ci`
4. `npm run check`
5. `npm run build:css`
6. Render Jade views with `node -e ...` to catch template errors

### Deploy: `.github/workflows/deploy.yml`

Triggered when:

- a CI workflow for `main` completes successfully
- the workflow conclusion is `success`

Deployment steps:

1. Set working directory to `APP_DIR`
2. Configure safe Git directory
3. `git fetch origin main`
4. `git checkout main`
5. `git reset --hard origin/main`
6. `npm ci`
7. `npm run build:css`

The current workflow file is already configured for a self-hosted runner and uses `APP_DIR` for the target application path.

## Self-Hosted Runner Environment

The deployment job expects the following Windows environment variable on the runner machine:

```powershell
[Environment]::SetEnvironmentVariable(
  "APP_DIR",
  "C:\path\to\warehouse-label-project",
  "Machine"
)
```

This is used by the workflow to locate the project folder for fetching updates and restarting the app.

## Deployment Notes

- The app loads `.env` locally, so environment values should exist on the runner machine.
- For production, create and maintain a real `.env` file on the deployment target.
- PM2 should be installed on the deployment machine.
- `pm2 save` should be run whenever the process list changes.

## Troubleshooting

### JavaScript syntax errors

Run:

```bash
npm run check
```

### CSS build issues

Run:

```bash
npm run build:css
```

### App not listening on expected port

Check:

- `.env` file exists
- `PORT` is valid
- no other process is already bound to the same port

### Printer not reachable

Check:

- `PRINTER_IP` is correct
- `PRINTER_PORT` is correct
- the printer is online and accessible on the LAN
- the network allows TCP connections to that port

### History not showing

Verify:

- the SQLite file exists in `data/labels.db`
- the app has write access to the `data/` folder
- batches and labels were actually inserted

## Security / Operational Considerations

- `.env` should not be committed to source control in production.
- The project currently writes `.env` values from the Settings page on the server filesystem.
- For production, consider restricting the Settings page or using a more controlled deployment process for environment changes.
- The database file is stored locally, so backup strategy should include regular copies of `data/labels.db`.

## Recommended Production Checklist

1. Install Node.js 24 and npm on the target machine
2. Install PM2 globally
3. Copy project files to the deployment directory
4. Create `.env` with printer and port values
5. Run `npm ci`
6. Run `npm run build:css`
7. Start with `pm2 start ecosystem.config.js`
8. Run `pm2 save`
9. Verify app health on the configured port
10. Confirm printer connectivity using the Settings page or `testConnection()`

## Future Improvements

Potential enhancements for this codebase include:

- structured logging with request IDs
- better batch retry policies
- export/import of batch history
- integration with an admin dashboard
- stronger environment validation at startup
- secure credentials management for external services

## License

No explicit license file is currently present in the repository.

# Device Networking: Reaching the API From a Phone or Emulator

How to connect the Expo app to your API for each setup: emulator or physical phone, same Wi-Fi or
a different network, and the API running in Docker or directly on your machine. Every check
below is a command you can run, so you can tell which hop is broken instead of guessing.

## Two Connections, Not One

The app on a device makes two separate connections to your computer. They fail independently.

| | 1. Metro (the JavaScript bundle) | 2. The API (every `[api]` request) |
|---|---|---|
| Port | 8081 | 3000 (`PORT`, or `API_HOST_PORT` in Docker) |
| Who serves it | `expo start` | `sora-server` in Docker, or `npm run dev:server` |
| How the device finds it | Expo tells it: QR code, `a` key, or tunnel URL | `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`, built into the bundle |
| Changed by `--tunnel`? | Yes | **No** |

Rules that follow from this:

- **If the app opens, Metro works.** If its requests then end in `network error`, connection 2
  is the broken one.
- **`expo start --tunnel` only fixes Metro.** API requests still go wherever
  `EXPO_PUBLIC_API_BASE_URL` says.
- **`localhost` means the device itself**, not your computer. On a phone or an emulator,
  `http://localhost:3000` reaches nothing unless something forwards it (see `adb reverse` below).

## Which Setup Do I Have?

The device column means where the app runs; the network column means how it reaches your
computer.

| # | Device | Network | Metro command | `EXPO_PUBLIC_API_BASE_URL` | Works with the API in Docker? |
|---|---|---|---|---|---|
| A | Android emulator on this PC | (same PC) | `npm run start:lan -w @sora/mobile`, then `a` | `http://10.0.2.2:3000` | Yes |
| B | Physical Android phone, USB cable | (cable) | `npm run start:lan -w @sora/mobile` | `http://localhost:3000` plus `adb reverse tcp:3000 tcp:3000` | Yes |
| C | Physical phone, **same** Wi-Fi as the PC | LAN | `npm run start:lan -w @sora/mobile` | `http://<PC's Wi-Fi IP>:3000` | Only if port 3000 accepts connections on the Wi-Fi address ([check](#check-c1-is-the-api-reachable-on-the-wi-fi-address)) |
| D | Physical phone, **different** network (mobile data, another Wi-Fi, guest Wi-Fi with client isolation) | Internet | `npm run dev:mobile` (tunnel) | an `https://` tunnel URL for port 3000 | Yes |
| E | iPhone (Expo Go) | as C or D | as C or D | as C or D | as C or D. No `adb reverse` on iOS |

How the start commands differ:
- `npm run dev:mobile` at the repo root is `expo start --go --tunnel`. It always tunnels Metro.
- `npm run start:lan -w @sora/mobile` is `expo start --go`, which serves Metro on your LAN
  without a tunnel. It's faster and enough for A, B and C.
- Both open the app in **Expo Go** (`--go`). If Metro serves a stale bundle, the variants with
  the cache cleared are `npm run dev:mobile:clear` (tunnel) and
  `npm run start:lan:clear -w @sora/mobile` (LAN).

## Rules That Apply to Every Case

### `EXPO_PUBLIC_*` values are baked into the bundle

`mobile/src/app/config/env.ts` reads `process.env.EXPO_PUBLIC_API_BASE_URL` when Metro bundles
the app, not when the app runs.
- After editing `mobile/.env`, restart Metro with the cache cleared. A plain reload keeps the old
  address.
- If the variable is unset, the app falls back to `http://localhost:3000`, which is almost never
  right on a device.
- `mobile/.env` is gitignored. Each developer sets their own.

To check which address the app is actually using: in a dev build, every request logs its full
URL to the Metro console, followed by its result:

```
[api] GET http://10.0.2.2:3000/api/v1/health
[api] ← 200 GET /api/v1/health
```

If the result is `← network error`, the request never got an HTTP response at all: the address
is wrong, nothing is listening there, or something on the way blocks it. If it shows a status
such as `401` or `500`, the network is fine and the problem is in the API.

### `http://` vs `https://`

| Build | `http://` API allowed? | Why |
|---|---|---|
| Expo Go (`--go`, all the commands above) | Yes | `__DEV__` is true, and Expo Go permits plain HTTP |
| E2E APK (`SORA_E2E_BUILD=1`) | Yes | `mobile/app.config.js` sets `usesCleartextTraffic` for that build only |
| Release or preview build | No, unless `EXPO_PUBLIC_ALLOW_INSECURE_API=true` | `assertSecureApiUrl` (`mobile/src/app/config/apiUrlPolicy.ts`) refuses to start, because tokens would cross the network in plain text. Android also blocks plain HTTP by default |

The tunnel URLs in case D are `https://`, so they work in every build.

### CORS doesn't matter for the phone

A native app sends no `Origin` header, so `CORS_ORIGINS` never blocks Expo Go on a phone or an
emulator. It only applies to the Expo **web** target running in a browser.

## Running the API: Docker vs Local

Pick one. Both want host port 3000, so run only one at a time, or move one to another port.

### API in Docker (`docker compose up -d`)

- **`sora-server`:** `docker-compose.yml` publishes it as `${API_HOST_PORT:-3000}:3000`. With no
  address given, Docker should accept connections on every interface of the PC (`0.0.0.0:3000`).
- **`sora-postgres`:** published on `127.0.0.1:${POSTGRES_HOST_PORT:-5432}` by default, so only
  this PC can reach it. That's deliberate: the phone talks to the API, never to the database.
- **Check from the PC:** `curl http://localhost:3000/api/v1/health` should print
  `{"status":"ok",…,"database":"up"}`.

**Known trap on Windows: Docker Desktop answers only on localhost.** Docker Desktop on Windows
can end up forwarding a published port through `localhost` only:
- `curl http://localhost:3000/api/v1/health` works;
- `curl http://<PC's Wi-Fi IP>:3000/api/v1/health` times out, even sent from the PC itself;
- `netstat -ano | findstr :3000` shows no `LISTENING` line.

When that happens:
- **Cases A, B and D still work.** They all arrive on the PC's localhost: the emulator's
  `10.0.2.2`, `adb reverse`, and a tunnel to `localhost:3000`.
- **Case C fails.** Fix it by restarting Docker Desktop (tray icon → Restart), or by running the
  API locally instead (below).
- **After a restart, check** that `netstat -ano | findstr :3000` shows
  `0.0.0.0:3000 … LISTENING`.

### API running locally (`npm run dev:server`)

The server (`server/src/main.ts`) calls `app.listen(PORT)` with no host, so Node accepts
connections on every interface (IPv4 and IPv6). Case C works without any extra setup.

**`npm run dev:server` and `npm start -w @sora/server` load the root `.env`** through Node's
`--env-file-if-exists`. A variable already set in the shell wins over the file, so a terminal that
exported an older value (VS Code's `python.terminal.useEnvFile` does this when the terminal opens)
keeps it until you open a new terminal.

**Use Docker's Postgres:** keep `docker compose up -d postgres` running and point `DATABASE_URL`
at `postgresql://<user>:<pass>@localhost:5432/sora_dev`. The database is published on
`127.0.0.1`, which the local server can reach.

**Port 3000 is already taken?** If `sora-server` (Docker) is still running, either:
- stop it with `docker compose stop server`; or
- run the local server on another port with `PORT=3001`, and use `:3001` in
  `EXPO_PUBLIC_API_BASE_URL`.

**Windows Firewall:** the first time Node listens, Windows asks whether to allow it. Allow
**Private** networks. Check what's already allowed:
```powershell
Get-NetConnectionProfile                         # the Wi-Fi must be "Private", not "Public"
Get-NetFirewallRule -Enabled True -Direction Inbound -Action Allow |
  Where-Object DisplayName -match 'Node|Docker' | Select-Object DisplayName, Profile
```

## Case A: Android Emulator on This PC

The emulator runs behind a virtual router, and its special address **`10.0.2.2` reaches the PC's
`127.0.0.1`**. Because requests arrive on the PC's localhost, this works with the API in Docker
even when Docker answers only on localhost.

1. Start the API (Docker or local) and check
   `curl http://localhost:3000/api/v1/health` on the PC.
2. Put this in `mobile/.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
   ```
3. Run `npm run start:lan:clear -w @sora/mobile`, then press `a`. Expo boots the emulator if
   needed and opens the app in Expo Go. That needs `ANDROID_HOME` set (see the README).
4. **Check** that the Metro console shows `[api] GET http://10.0.2.2:3000/…` then `← 200`. You
   can also open `http://10.0.2.2:3000/api/v1/health` in the emulator's Chrome.

Alternative: run `adb reverse tcp:3000 tcp:3000` and keep `http://localhost:3000`, as in case B.

`10.0.2.2` is specific to the Android emulator. On the iOS simulator (macOS only), the simulator
shares the Mac's network, so `http://localhost:3000` works directly.

## Case B: Physical Android Phone Over USB

`adb reverse` makes the phone's `localhost:3000` forward over the cable to the PC's
`localhost:3000`. No Wi-Fi is involved, so firewall rules, client isolation and Docker's
localhost-only behaviour don't matter.

1. On the phone, enable Developer options → **USB debugging**. Plug it in and accept the
   "Allow USB debugging" prompt.
2. On the PC, run `adb devices -l`. The phone must be listed as `device`, not `unauthorized`.
3. Forward the API port:
   ```bash
   adb reverse tcp:3000 tcp:3000
   adb reverse --list          # shows: tcp:3000 tcp:3000
   ```
4. Put this in `mobile/.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
   ```
5. Run `npm run start:lan:clear -w @sora/mobile` and open the app in Expo Go. You can also run
   `adb reverse tcp:8081 tcp:8081` and open `exp://localhost:8081` in Expo Go, so Metro uses the
   cable too.
6. **Check** that `http://localhost:3000/api/v1/health` opens in the phone's browser.

The forwarding is lost whenever the phone disconnects, adb restarts, or the PC reboots. Re-run
step 3 after that.

## Case C: Physical Phone on the Same Wi-Fi

The phone calls the PC's Wi-Fi address. That needs three things:
- both devices on the same network;
- the network lets devices see each other;
- the API accepting connections on that Wi-Fi address.

Being on the same Wi-Fi covers only the first two.

1. Find the PC's Wi-Fi address with `ipconfig`: the `IPv4 Address` under the Wi-Fi adapter, e.g.
   `192.168.1.23`. Ignore `169.254.*` addresses, which are unconnected adapters.
2. Put this in `mobile/.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
   ```
3. Run `npm run start:lan:clear -w @sora/mobile` and scan the QR code in Expo Go.
4. Run the checks below, in order. Each one isolates one hop.

#### Check C1: is the API reachable on the Wi-Fi address?

Run this from the PC:
```bash
curl -m 5 http://192.168.1.23:3000/api/v1/health
netstat -ano | findstr :3000
```
- **Pass:** `curl` prints the health JSON, and `netstat` shows `0.0.0.0:3000` (or `[::]:3000`)
  `LISTENING`.
- **Fail with the API in Docker:** `curl` times out and `netstat` shows nothing. Docker is
  answering on localhost only; see the
  [known trap](#api-in-docker-docker-compose-up--d). Restart Docker Desktop, or run the API
  locally.
- **Fail with the API local:** check that the server actually started (look at its console), and
  that `PORT` matches the URL.

#### Check C2: can the phone reach the PC at all?

Metro already proves this. If the app loaded with `start:lan`, the phone reached
`192.168.1.23:8081`, and `netstat -ano | findstr :8081` shows an `ESTABLISHED` connection from
the phone's address.
- If the app doesn't load either, the network itself is the problem. Look for guest Wi-Fi with
  client isolation, a VPN on either device, or the phone on mobile data. Treat it as case D.

#### Check C3: does the firewall let port 3000 in?

Open `http://192.168.1.23:3000/api/v1/health` in the **phone's browser**.
- If C1 passed on the PC but the phone's browser times out, Windows Firewall is blocking it.
- Check that the network profile is **Private** (`Get-NetConnectionProfile`), and that Node.js or
  Docker Desktop Backend is allowed on Private (commands under
  [Windows Firewall](#api-running-locally-npm-run-devserver)).

## Case D: Physical Phone on a Different Network

This covers mobile data, a different Wi-Fi, a guest network that isolates devices, or a phone on
a VPN. The phone can't reach any LAN address of the PC, so **both** connections need a public
route.

1. **Metro:** `npm run dev:mobile` already runs `expo start --tunnel`. Scan its QR code in Expo
   Go.
2. **API:** expose `localhost:3000` through a tunnel of your own. Expo's tunnel doesn't carry it.
   Either of these works, but each needs its tool installed (not a repo dependency):
   ```bash
   cloudflared tunnel --url http://localhost:3000     # prints https://<random>.trycloudflare.com
   ngrok http 3000                                     # prints https://<random>.ngrok-free.app
   ```
3. Put the printed URL in `mobile/.env`, with no trailing slash and no `/api/v1`:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://<random>.trycloudflare.com
   ```
4. Run `npm run dev:mobile:clear`, because the URL is baked into the bundle.
5. **Check** that `https://<random>.trycloudflare.com/api/v1/health` opens in the phone's browser
   **on mobile data**.

Things to know:
- **The tunnel connects to the PC's localhost**, so it works with the API in Docker even when
  Docker answers only on localhost.
- **Quick tunnels get a new URL each run.** Update `mobile/.env` and restart Metro with the
  cache cleared every time.
- **The tunnel makes your dev API public.** Anyone who has the URL can call it, and the
  auth-route rate limits are the only throttle. Stop it when you're done, and never point it at
  a database holding real data.
- **The URL is `https://`**, so the same setup also works for a preview build.

## Case E: iPhone

Expo Go on an iPhone works like an Android phone, with these differences:
- **No `adb`**, so there's no USB forwarding. Use case C (same Wi-Fi) or case D (tunnel).
- **iOS asks for permission to find devices on your local network** the first time Expo Go
  connects over the LAN. If you denied it, case C fails until you enable it in Settings →
  Expo Go → Local Network.
- **The iOS simulator needs macOS.** On a Mac, the simulator can use `http://localhost:3000`
  directly.

## Troubleshooting by Symptom

| Symptom | Likely cause | Where to look |
|---|---|---|
| App doesn't open; Expo Go says it can't connect | Metro unreachable (connection 1) | Same network? Guest Wi-Fi? Use `npm run dev:mobile` (tunnel) |
| App opens; every request shows `← network error` | API unreachable (connection 2) | `[api]` log URL; then the checks for your case |
| `[api]` log shows `http://localhost:3000` on a phone, with no `adb reverse` | `mobile/.env` missing or not picked up | Create `mobile/.env`; restart Metro with the cache cleared |
| Log still shows the old address after editing `mobile/.env` | Metro served the cached bundle | `…:clear` variant of the start command |
| Same Wi-Fi; `curl localhost:3000` works but `curl <Wi-Fi IP>:3000` times out on the PC | Docker Desktop answering on localhost only | Restart Docker Desktop, or run the API locally |
| `curl <Wi-Fi IP>:3000` works on the PC, times out from the phone's browser | Windows Firewall or a Public network profile | [Check C3](#check-c3-does-the-firewall-let-port-3000-in) |
| Emulator: `network error` with `10.0.2.2` | API not running, or on a different port | `curl http://localhost:3000/api/v1/health` on the PC |
| USB: worked, then stopped | `adb reverse` lost after a reconnect | `adb reverse --list`; re-run `adb reverse tcp:3000 tcp:3000` |
| Requests show `← 4xx/5xx` | Network is fine; the API rejected or failed the request | `rtk proxy docker logs sora-server --tail 100`, or the local server's console |
| Release build crashes at start: "must use https://" | `assertSecureApiUrl` | Use an `https://` URL, or `EXPO_PUBLIC_ALLOW_INSECURE_API=true` for a LAN preview |

# Event Invitation Writer (QVAC)

Fill in your event (a birthday, graduation, game night, barbecue...) with the date, time, place and RSVP, pick a style, and an **on-device AI** writes a catchy headline and a warm message. See it on a **printable invitation card** with four designs, edit the message right on the card, and download an **add-to-calendar file (.ics)** for your guests.

It runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK.
No API key, no cloud service, and what you type never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `completion` (with structured output via `responseFormat`), with the `LLAMA_3_2_1B_INST_Q4_0` model.

## Install

You need [Node.js](https://nodejs.org) 22 or newer and some free disk space for the model.

```bash
git clone https://github.com/misaki-codex/qvac-invitation-writer.git
cd qvac-invitation-writer
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3073** (the address, not the HTML file). The first start downloads the model.
While it loads, a template message for your type of event is used instead.

## How it works

- The AI only writes the headline and message, through a JSON schema. **The date, time, place and RSVP are shown exactly as you typed them**: the AI never rewrites them, so they can't be wrong.
- The calendar file is built by plain code (standard iCalendar format) and works with Google Calendar, Outlook and Apple Calendar.
- Printing shows only the card.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## Troubleshooting

If you see `RPC_INIT_TIMEOUT`, the QVAC worker was slow to start. `server.js` already waits 3 minutes.
Set `QVAC_RPC_INIT_TIMEOUT_MS` (milliseconds) before `npm start` to wait longer, and make sure no other
QVAC app is running at the same time. If you see `ERR_MODULE_NOT_FOUND`, delete the `node_modules` folder
and run `npm install` again (this usually means an install was interrupted, for example by a full disk).

## License

MIT

# Social Media Dashboard (MVP)

A 3-page React + Tailwind website implementation based on the planning docs.

## Implemented Pages
- Posts (human-only posting surface)
- Messages (connected chat + inline privacy/policy rail)
- Profile (privacy boundaries + text-only upload)

## Key MVP Constraints Included
- Bright editorial UI (no dark mode, no purple gradients, no glassmorphism)
- `max_messages = 150`
- `max_privacy_retries = 3`
- WebSocket simulation used only on Messages page
- localStorage persistence for active nav page

## Run Locally
```bash
cd /Users/jadenwu/Desktop/Hackathon/my-app
npm install
npm run dev
```

## Folder Structure
```text
/my-app
├── /public
├── /src
│   ├── /assets
│   ├── /components
│   ├── /features
│   ├── /hooks
│   ├── /pages
│   ├── /services
│   ├── /styles
│   ├── /utils
│   ├── App.jsx
│   └── main.jsx
├── .gitignore
├── package.json
└── README.md
```

## Notes
- This repo contains a framework-agnostic React source layout with Tailwind config.
- If you want a runnable setup immediately, you can drop these files into an existing CRA or Vite React project and install dependencies.

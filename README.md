# Study Group

A quiet, minimal study room for middle and high school students. Pick a nickname, start or join a room with a 6-character code, add tasks, post updates (6 per hour), and focus together on a shared timer.

Live site: https://adude123-cyber.github.io/study-group/

## Features

- No account: a nickname and a color
- Rooms with random 6-character codes, plus a "jump back in" list
- Instagram-style feed with a rubber-stamp animation when someone finishes a task
- 6 posts per hour per person (finished tasks don't count)
- Tasks with subjects, time estimates and due dates; join a friend's task or ask for help
- Room goal with a progress bar
- Shared focus timer (15/25/50 min), breaks with flashcard quizzes
- Personal stats, day streak, badges, weekly recap; group streak
- Background sounds: brown noise, rain, café, lo-fi
- Host tools: lock room, approve new people, quiet focus, class mode, reports, remove people, delete room

## Setup (one time, about 5 minutes)

The site is static, so it needs a free Firebase project for live rooms.

1. Go to https://console.firebase.google.com and click **Create a project**. Google Analytics is optional; you can turn it off.
2. In the project, open **Build → Authentication → Get started → Sign-in method**, and enable **Anonymous**.
3. Open **Build → Firestore Database → Create database**. Pick a location near your users and start in **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
5. In Firestore, open the **Indexes** tab and add a composite index on collection `events` with fields `uid` (Ascending), `type` (Ascending), `ts` (Descending). This powers the 6-posts-per-hour counter. You can skip it; the page falls back to counting in the browser.
6. Open **Project settings** (gear icon) → **Your apps** → click the **</>** web icon, register an app (no hosting needed), and copy the `firebaseConfig` object.
7. Paste it into `firebase-config.js` as `window.SG_FIREBASE_CONFIG = { ... }`, then commit and push.
8. In **Authentication → Settings → Authorized domains**, add `adude123-cyber.github.io`.

The Firebase web config is meant to be public. Access is controlled by `firestore.rules`.

## Notes

- Identity is an anonymous Firebase sign-in per browser. Someone who clears their browser data gets a new identity, so a removed person could come back with a new one. Approval mode is the stronger guard.
- The post limit and word filter run in the browser. They stop ordinary use, not a determined person.
- Feed posts older than 14 days are deleted when the room's host opens the room.

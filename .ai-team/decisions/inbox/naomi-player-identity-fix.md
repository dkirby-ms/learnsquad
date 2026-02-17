### 2026-02-17: Use room.sessionId for current player identity

**By:** Naomi

**What:** Fixed player identity logic to use `room.sessionId` instead of assuming `players[0]` is the current player. Updated `useGameSocket` to expose `currentSessionId`, added `currentSessionId` tracking to `gameStateStore`, and created `useCurrentPlayer()` hook. Fixed `GameWorld.tsx` and `ChatPanel.tsx` to use the correct current player.

**Why:** Alex caught a critical bug in code review — `players[0]` is not the current player in multiplayer sessions, it's just whoever joined first. This caused chat messages to be misattributed. The Colyseus `room.sessionId` identifies the current connection and matches the player's ID in the `players` map. This is the correct way to determine "who am I" in a multiplayer game.

**Pattern:** Always use `room.sessionId` to find the current player. Never rely on array position for identity in multiplayer contexts.

# Router-Based Communication Web System - Procedure & Architecture

## Architecture

- **Backend Framework:** Node.js with Express.js
- **Real-time Engine:** Socket.IO for chat, WebRTC signaling, and syncing.
- **Database:** Client-side local storage (IndexedDB) for persistent data (like WhatsApp). Server will temporarily hold messages for offline users.
- **Frontend Framework:** React (via Vite) with Vanilla CSS for styling (premium, dynamic design).
- **Audio/Video Calls:** WebRTC (Peer-to-Peer)

## Implementation Phases

### Phase 1: Project & Server Initialization
- Initialize a monorepo structure.
- Setup `backend` and `frontend` directories.
- Create a basic Express server and integrate Socket.IO.

### Phase 2: Client-side Storage & Authentication
- Implement IndexedDB on the frontend to store `User`, `Message`, `Group`, `File` metadata.
- Implement user identity generation (e.g., generating a unique ID and storing it locally).
- Create backend signaling for user discovery.

### Phase 3: Core Chat & Groups
- Build the premium frontend UI layout (Sidebar, Chat window, Profile section).
- Implement real-time WebSocket connections for message delivery.
- Save incoming/outgoing messages to local IndexedDB.
- Implement group creation and group messaging (broadcasting to group members).

### Phase 4: File Sharing
- Setup P2P file transfer (WebRTC Data Channels) for large files, or chunked upload/download through the server for offline delivery.
- Add file attachment UI to the chat interface.

### Phase 5: Voice and Video Calls
- Implement WebRTC signaling logic via Socket.IO.
- Build a stunning in-app call interface (video grid, mute/unmute, end call buttons).
- Handle peer-to-peer connection establishment for high-quality local network calls.

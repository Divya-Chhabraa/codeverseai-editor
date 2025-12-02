import { io } from 'socket.io-client';

export const initSocket = async () => {
    const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1");

    const backendUrl = isLocalhost
        ? "http://localhost:5000"
        : "https://codeverseai-editor-production.up.railway.app";

    console.log("🔌 Connecting to backend:", backendUrl);

    return io(backendUrl, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        secure: !isLocalhost,  // 🚀 Must be true on Railway
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        path: "/socket.io/"  // 🚀 Required to match server route
    });
};
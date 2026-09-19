import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        watch: {
            // Vite runs inside WSL but the project lives on the Windows drive
            // (/mnt/c/...). Linux inotify events do not cross that boundary,
            // so Vite never sees Ctrl+S and the browser never refreshes.
            // Polling makes Vite detect saves made from the Windows side.
            usePolling: true
        }
    }
});

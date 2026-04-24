/**
 * CSRF Manager - Handles CSRF token extraction and management
 *
 * CSRF protection is implemented using gorilla/csrf on the backend.
 * The token is automatically set as an HttpOnly cookie named '_csrf_token'
 * on every GET request.
 *
 * For authenticated POST/PUT/DELETE requests, the token must be included
 * in the X-CSRF-Token header. The api-client.ts automatically handles this.
 */

export class CSRFManager {
    private static token: string | null = null;
    private static readonly COOKIE_NAME = '_csrf_token';

    /**
     * Get the CSRF token from the cookie
     */
    static getToken(): string | null {
        if (this.token) return this.token;
        const match = document.cookie.match(
            new RegExp(`${this.COOKIE_NAME}=([^;]+)`)
        );
        this.token = match ? decodeURIComponent(match[1]) : null;
        return this.token;
    }

    /**
     * Clear the cached token and delete the cookie
     * Useful for logout or when token might be invalidated
     */
    static clear(): void {
        this.token = null;
        document.cookie = `${this.COOKIE_NAME}=; Max-Age=0; path=/`;
    }
}

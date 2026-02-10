/**
 * In-Memory Token Cache Service
 * 
 * Caches Microsoft 365 access tokens per studio to avoid unnecessary token requests.
 * Tokens are cached with automatic expiration based on expires_in from Microsoft.
 * 
 * Thread-safe for concurrent requests.
 */

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

class TokenCacheService {
  private cache: Map<string, CachedToken>;
  private readonly SAFETY_MARGIN_MS = 5 * 60 * 1000; // 5 minutes before actual expiry

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached token if valid, null if expired/not found
   */
  get(studioId: string): string | null {
    const cached = this.cache.get(studioId);
    
    if (!cached) {
      return null;
    }

    const now = Date.now();
    
    // Check if token is still valid (with safety margin)
    if (now >= cached.expiresAt - this.SAFETY_MARGIN_MS) {
      console.log(`[Token Cache] Token expired for studio ${studioId}`);
      this.cache.delete(studioId);
      return null;
    }

    console.log(`[Token Cache] Using cached token for studio ${studioId}`);
    return cached.accessToken;
  }

  /**
   * Store token in cache with expiration
   */
  set(studioId: string, accessToken: string, expiresInSeconds: number): void {
    const expiresAt = Date.now() + (expiresInSeconds * 1000);
    
    this.cache.set(studioId, {
      accessToken,
      expiresAt,
    });

    console.log(`[Token Cache] Cached token for studio ${studioId} (expires in ${expiresInSeconds}s)`);
  }

  /**
   * Invalidate token for a studio
   */
  invalidate(studioId: string): void {
    const deleted = this.cache.delete(studioId);
    if (deleted) {
      console.log(`[Token Cache] Invalidated token for studio ${studioId}`);
    }
  }

  /**
   * Clear all cached tokens
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[Token Cache] Cleared ${size} cached tokens`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      studios: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const tokenCache = new TokenCacheService();
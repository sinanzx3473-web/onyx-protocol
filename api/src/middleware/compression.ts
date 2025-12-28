import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Compression middleware configuration
 * Compresses responses using gzip/deflate for better performance
 */
export const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  
  // Compression level (0-9, higher = better compression but slower)
  level: 6,
  
  // Filter function to determine what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Don't compress streaming responses
    if (res.getHeader('Content-Type')?.toString().includes('stream')) {
      return false;
    }
    
    // Use compression filter for everything else
    return compression.filter(req, res);
  },
  
  // Memory level (1-9, higher = more memory but better compression)
  memLevel: 8,
});

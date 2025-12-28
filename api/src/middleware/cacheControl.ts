import { Request, Response, NextFunction } from 'express';

/**
 * Cache control middleware for different route types
 */

// No cache for dynamic/sensitive data
export const noCache = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
};

// Short cache for frequently changing data (5 minutes)
export const shortCache = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
  });
  next();
};

// Medium cache for semi-static data (1 hour)
export const mediumCache = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=300',
  });
  next();
};

// Long cache for static data (1 day)
export const longCache = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600, immutable',
  });
  next();
};

// Conditional cache based on query params
export const conditionalCache = (req: Request, res: Response, next: NextFunction) => {
  // If request has authentication or user-specific params, don't cache
  if (req.headers.authorization || req.query.userId) {
    return noCache(req, res, next);
  }
  
  // Otherwise use short cache
  return shortCache(req, res, next);
};

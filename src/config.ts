export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // requests per window
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};

import app from './app';
import { config } from './config';
import { prisma } from './lib/prisma';

async function main() {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('✓ Database connected');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  }

  // Start server
  app.listen(config.port, () => {
    console.log(`🦞 Clawsta API running on port ${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main();

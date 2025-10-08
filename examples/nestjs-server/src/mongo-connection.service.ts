import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
// Import AppConfig to get MongoDB connection string from config file via nestjs-env-getter
import { AppConfig } from './app.config';

@Injectable()
export class MongoConnectionService implements OnModuleInit, OnModuleDestroy {
  // Use NestJS Logger for logging connection events
  private readonly logger: Logger = new Logger('MongoConnectionService');
  private checkInterval: NodeJS.Timeout | null = null;
  private lastConnectionString: string;
  private isReconnecting = false;

  // Inject AppConfig to get MongoDB connection string from config file
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: AppConfig,
  ) {
    this.lastConnectionString = this.config.mongoConfigs.connectionString;
  }

  async onModuleInit() {
    // Monitor connection state and log events
    this.connection.on('connected', () => {
      this.logger.log('✅ MongoDB connected');
    });

    this.connection.on('disconnected', () => {
      this.logger.warn('❌ MongoDB disconnected');
    });

    this.connection.on('error', (error) => {
      this.logger.error('❌ MongoDB connection error:', error);
    });

    // Periodically check for config changes and reconnect if needed
    this.checkInterval = setInterval(() => {
      this.checkAndReconnect();
    }, 2000);
  }

  onModuleDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  // Checks for changes in MongoDB connection string and reconnects if needed
  private async checkAndReconnect() {
    if (this.isReconnecting) {
      return; // Avoid concurrent reconnection attempts
    }

    const currentConnectionString = this.config.mongoConfigs.connectionString;

    // If connection string changed, reconnect
    if (currentConnectionString !== this.lastConnectionString) {
      this.isReconnecting = true;
      this.logger.log('🔄 MongoDB credentials changed, reconnecting...');
      this.logger.debug(`   Old: ${this.maskConnectionString(this.lastConnectionString)}`);
      this.logger.debug(`   New: ${this.maskConnectionString(currentConnectionString)}`);

      try {
        // Close existing connection gracefully
        if (this.connection.readyState !== 0) {
          await this.connection.close(false);
          this.logger.log('   Connection closed');
        }

        // Connect with new credentials
        await this.connection.openUri(currentConnectionString);

        this.lastConnectionString = currentConnectionString;
        this.logger.log('✅ Successfully reconnected to MongoDB with updated credentials');
      } catch (error) {
        this.logger.error('❌ Failed to reconnect to MongoDB:', error);
        // Optionally: implement retry logic here
      } finally {
        this.isReconnecting = false;
      }
    }
  }

  private maskConnectionString(uri: string): string {
    try {
      const url = new URL(uri);
      if (url.password) {
        return uri.replace(url.password, '***');
      }
      return uri;
    } catch {
      return '***';
    }
  }

  getConnectionStatus(): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[this.connection.readyState as keyof typeof states] || 'unknown';
  }
}

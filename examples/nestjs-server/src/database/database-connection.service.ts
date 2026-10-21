import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG } from 'nestjs-env-getter';
import { AppConfig } from '../app.config';

export interface DatabaseStatus {
  status: 'connected';
  maskedUri: string;
  reconnectCount: number;
  lastReconnectAt: string | null;
  lastError: string | null;
  firstUpdateReceived: boolean;
}

@Injectable()
export class DatabaseConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseConnectionService.name);
  private maskedUri: string;
  private reconnectCount = 0;
  private lastReconnectAt: string | null = null;
  private lastError: string | null = null;
  private firstUpdateReceived = false;
  private readonly updateSubscription: { unsubscribe(): void };
  private readonly errorHandler: (event: { filePath: string; error: Error }) => void;

  // Demonstrates injecting the root config via @Inject(APP_CONFIG) (MOD-1 / EX-5)
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.maskedUri = this.maskConnectionString(this.config.mongoConfigs.connectionString);

    // Demonstrates once() on a file config: runs only on the first hot-reload (EX-5)
    this.config.mongoConfigs.once('updated', (event) => {
      this.firstUpdateReceived = true;
      this.logger.log(`First hot-reload observed for ${event.filePath}`);
    });

    // Demonstrates on() returning a Disposable with .unsubscribe() (EX-5)
    this.updateSubscription = this.config.mongoConfigs.on('updated', (event) => {
      this.logger.log(`Database credentials updated from ${event.filePath}`);
      this.handleConfigUpdate();
    });

    this.errorHandler = (event) => {
      this.lastError = event.error.message;
      this.logger.error(`Database credentials reload failed (${event.filePath}): ${event.error.message}`);
    };
    this.config.mongoConfigs.on('error', this.errorHandler);
  }

  onModuleDestroy(): void {
    // Demonstrates both Disposable.unsubscribe() and off() (EX-5)
    this.updateSubscription.unsubscribe();
    this.config.mongoConfigs.off('error', this.errorHandler);
  }

  getStatus(): DatabaseStatus {
    return {
      status: 'connected',
      maskedUri: this.maskedUri,
      reconnectCount: this.reconnectCount,
      lastReconnectAt: this.lastReconnectAt,
      lastError: this.lastError,
      firstUpdateReceived: this.firstUpdateReceived,
    };
  }

  private handleConfigUpdate(): void {
    const newMasked = this.maskConnectionString(this.config.mongoConfigs.connectionString);
    this.logger.log(`Simulated database reconnect: ${this.maskedUri} -> ${newMasked}`);
    this.maskedUri = newMasked;
    this.reconnectCount += 1;
    this.lastReconnectAt = new Date().toISOString();
    this.lastError = null;
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
}

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConnectionService } from './database/database-connection.service';

describe('AppController', () => {
  let appController: AppController;
  const appServiceMock = {
    getHello: jest.fn().mockReturnValue('Hello World!'),
    getTestConfigValue: jest.fn().mockReturnValue({}),
    getGroupedConfigDiagnostics: jest.fn().mockReturnValue({}),
  };
  const dbServiceMock = {
    getStatus: jest.fn().mockReturnValue({
      status: 'connected',
      maskedUri: 'mongodb://user:***@localhost:27017/mydb',
      reconnectCount: 0,
      lastReconnectAt: null,
      lastError: null,
      firstUpdateReceived: false,
    }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: appServiceMock },
        { provide: DatabaseConnectionService, useValue: dbServiceMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('should return database status from /db/status', () => {
      expect(appController.getDatabaseStatus().reconnectCount).toBe(0);
    });
  });
});

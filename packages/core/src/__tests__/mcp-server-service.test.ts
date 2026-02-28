/**
 * Unit tests for MCP Server Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPServerService } from '../services/mcp-server-service';
import type { MCPServer, CreateMCPServer, UpdateMCPServer } from '@repo/core';

describe('MCPServerService', () => {
  let service: MCPServerService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      findByName: vi.fn(),
      findAll: vi.fn(),
      findByType: vi.fn(),
      findByStatus: vi.fn(),
      findActive: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
      healthCheck: vi.fn(),
    };

    service = new MCPServerService(mockRepository);
    vi.clearAllMocks();
  });

  describe('createServer', () => {
    it('should create a valid server', async () => {
      const data: CreateMCPServer = {
        name: 'test-server',
        type: 'stdio',
        connectionConfig: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
        status: 'active',
      };

      const expectedServer: MCPServer = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: data.name,
        type: data.type,
        connectionConfig: data.connectionConfig,
        capabilities: undefined,
        status: 'active',
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockRepository.findByName).mockResolvedValue(null);
      vi.mocked(mockRepository.create).mockResolvedValue(expectedServer);

      const result = await service.createServer(data);

      expect(result).toEqual(expectedServer);
      expect(mockRepository.findByName).toHaveBeenCalledWith(data.name);
      expect(mockRepository.create).toHaveBeenCalledWith(data);
    });

    it('should throw error if server already exists', async () => {
      const data: CreateMCPServer = {
        name: 'existing-server',
        type: 'stdio',
        connectionConfig: { command: 'test' },
        status: 'active',
      };

      const existingServer: MCPServer = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: data.name,
        type: data.type,
        connectionConfig: data.connectionConfig,
        capabilities: undefined,
        status: 'active',
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockRepository.findByName).mockResolvedValue(existingServer);

      await expect(service.createServer(data)).rejects.toThrow(
        "MCP server with name 'existing-server' already exists"
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid server', async () => {
      const data: CreateMCPServer = {
        name: '',
        type: 'invalid' as any,
        connectionConfig: null as any,
        status: 'active',
      };

      vi.mocked(mockRepository.findByName).mockResolvedValue(null);

      await expect(service.createServer(data)).rejects.toThrow(
        'Invalid server: Name is required, Type must be one of: stdio, http, sse, Connection config is required and must be an object'
      );
    });
  });

  describe('getServer', () => {
    it('should return a server by name', async () => {
      const server: MCPServer = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: 'test-server',
        type: 'stdio',
        connectionConfig: { command: 'test' },
        capabilities: undefined,
        status: 'active',
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockRepository.findByName).mockResolvedValue(server);

      const result = await service.getServer('test-server');

      expect(result).toEqual(server);
      expect(mockRepository.findByName).toHaveBeenCalledWith('test-server');
    });
  });

  describe('updateServer', () => {
    it('should update an existing server', async () => {
      const existingServer: MCPServer = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: 'test-server',
        type: 'stdio',
        connectionConfig: { command: 'test' },
        capabilities: undefined,
        status: 'active',
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      const updateData: UpdateMCPServer = {
        status: 'inactive',
      };

      const updatedServer: MCPServer = {
        ...existingServer,
        status: updateData.status || existingServer.status,
      };

      vi.mocked(mockRepository.findByName).mockResolvedValue(existingServer);
      vi.mocked(mockRepository.update).mockResolvedValue(updatedServer);

      const result = await service.updateServer('test-server', updateData);

      expect(result).toEqual(updatedServer);
      expect(mockRepository.update).toHaveBeenCalledWith('test-server', updateData);
    });

    it('should throw error when trying to change server name', async () => {
      const existingServer: MCPServer = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: 'test-server',
        type: 'stdio',
        connectionConfig: { command: 'test' },
        capabilities: undefined,
        status: 'active',
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      const updateData: UpdateMCPServer = {
        name: 'new-name',
      };

      vi.mocked(mockRepository.findByName).mockResolvedValue(existingServer);

      await expect(service.updateServer('test-server', updateData)).rejects.toThrow(
        'Cannot change MCP server name'
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should return null for non-existent server', async () => {
      vi.mocked(mockRepository.findByName).mockResolvedValue(null);

      const result = await service.updateServer('non-existent', { status: 'inactive' });

      expect(result).toBeNull();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateServerStatus', () => {
    it('should update server status', async () => {
      const existingServer: MCPServer = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        name: 'test-server',
        type: 'stdio',
        connectionConfig: { command: 'test' },
        capabilities: undefined,
        status: 'active',
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockRepository.findByName).mockResolvedValue(existingServer);
      vi.mocked(mockRepository.updateStatus).mockResolvedValue(true);

      const result = await service.updateServerStatus('test-server', 'inactive');

      expect(result).toBe(true);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('test-server', 'inactive');
    });

    it('should return false for non-existent server', async () => {
      vi.mocked(mockRepository.findByName).mockResolvedValue(null);

      const result = await service.updateServerStatus('non-existent', 'inactive');

      expect(result).toBe(false);
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('performHealthCheck', () => {
    it('should return health status of all servers', async () => {
      const healthStatus = {
        'server-1': true,
        'server-2': false,
        'server-3': true,
      };

      vi.mocked(mockRepository.healthCheck).mockResolvedValue(healthStatus);

      const result = await service.performHealthCheck();

      expect(result).toEqual(healthStatus);
      expect(mockRepository.healthCheck).toHaveBeenCalled();
    });
  });

  describe('validateServer', () => {
    it('should validate a correct STDIO server', async () => {
      const data: CreateMCPServer = {
        name: 'github-mcp',
        type: 'stdio',
        connectionConfig: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github']
        },
        status: 'active',
        capabilities: {
          tools: ['search_code', 'get_file', 'create_issue'],
          resources: ['repositories', 'issues']
        },
      };

      const result = await service.validateServer(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a correct HTTP server', async () => {
      const data: CreateMCPServer = {
        name: 'http-server',
        type: 'http',
        connectionConfig: { url: 'http://localhost:3000' },
        status: 'active',
      };

      const result = await service.validateServer(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid server', async () => {
      const data: CreateMCPServer = {
        name: 'invalid name!',
        type: 'invalid' as any,
        connectionConfig: null as any,
        status: 'active',
        capabilities: {
          tools: 'not an array' as any,
          resources: 'also not an array' as any,
        },
      };

      const result = await service.validateServer(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name can only contain letters, numbers, hyphens, and underscores');
      expect(result.errors).toContain('Type must be one of: stdio, http, sse');
      expect(result.errors).toContain('Connection config is required and must be an object');
      expect(result.errors).toContain('Capabilities.tools must be an array');
      expect(result.errors).toContain('Capabilities.resources must be an array');
    });

    it('should require command for STDIO servers', async () => {
      const data: CreateMCPServer = {
        name: 'stdio-server',
        type: 'stdio',
        connectionConfig: { url: 'http://localhost:3000' }, // Wrong config for STDIO
        status: 'active',
      };

      const result = await service.validateServer(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('STDIO servers require a command in connection config');
    });

    it('should require URL for HTTP servers', async () => {
      const data: CreateMCPServer = {
        name: 'http-server',
        type: 'http',
        connectionConfig: { command: 'node' }, // Wrong config for HTTP
        status: 'active',
      };

      const result = await service.validateServer(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('HTTP servers require a URL in connection config');
    });
  });
});

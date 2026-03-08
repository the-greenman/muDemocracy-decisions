import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  createMeetingRoute,
  listMeetingsRoute,
  getMeetingRoute,
} from './routes/meetings';
import {
  createDecisionLogGenerator,
  createDecisionLogService,
  createDecisionContextService,
  createDecisionContextRepository,
  createDecisionFieldService,
  createDraftGenerationService,
  createFlaggedDecisionService,
  type GuidanceSegment,
  createLLMInteractionService,
  createMarkdownExportService,
  createMeetingService,
  createTemplateFieldAssignmentRepository,
  createTranscriptService,
  MeetingService,
} from '@repo/core';
import { DrizzleMeetingRepository } from '@repo/db';
import { MockMeetingRepository } from './mock-repository';
import {
  createDecisionContextRoute,
  createFlaggedDecisionRoute,
  exportDecisionLogRoute,
  exportMarkdownRoute,
  getDecisionLogRoute,
  getFieldTranscriptRoute,
  generateDraftRoute,
  listDraftVersionsRoute,
  listLLMInteractionsRoute,
  logDecisionRoute,
  lockFieldRoute,
  regenerateFieldRoute,
  rollbackDraftRoute,
  unlockFieldRoute,
  updateFieldValueRoute,
  uploadTranscriptRoute,
} from './routes/decision-workflow';

// Determine which repository to use
const useDatabase = process.env.DATABASE_URL !== undefined;

// Create repository and service instances
const repo = useDatabase 
  ? new DrizzleMeetingRepository() 
  : new MockMeetingRepository();

console.log(`Using ${useDatabase ? 'Drizzle' : 'Mock'} repository`);

const meetingService = useDatabase ? createMeetingService() : new MeetingService(repo);
const transcriptService = useDatabase ? createTranscriptService() : null;
const flaggedDecisionService = useDatabase ? createFlaggedDecisionService() : null;
const decisionContextService = useDatabase ? createDecisionContextService() : null;
const decisionLogService = useDatabase ? createDecisionLogService() : null;
const decisionLogGenerator = useDatabase ? createDecisionLogGenerator() : null;
const draftGenerationService = useDatabase ? createDraftGenerationService() : null;
const markdownExportService = useDatabase ? createMarkdownExportService() : null;
const llmInteractionService = useDatabase ? createLLMInteractionService() : null;
const decisionContextRepository = useDatabase ? createDecisionContextRepository() : null;
const decisionFieldService = useDatabase ? createDecisionFieldService() : null;
const templateFieldAssignmentRepository = useDatabase ? createTemplateFieldAssignmentRepository() : null;

function getWorkflowServices() {
  if (
    !transcriptService ||
    !flaggedDecisionService ||
    !decisionContextService ||
    !decisionContextRepository ||
    !decisionFieldService ||
    !decisionLogService ||
    !decisionLogGenerator ||
    !draftGenerationService ||
    !markdownExportService ||
    !llmInteractionService ||
    !templateFieldAssignmentRepository
  ) {
    return null;
  }

  return {
    transcriptService,
    flaggedDecisionService,
    decisionContextService,
    decisionContextRepository,
    decisionFieldService,
    decisionLogService,
    decisionLogGenerator,
    draftGenerationService,
    markdownExportService,
    llmInteractionService,
    templateFieldAssignmentRepository,
  };
}

async function resolveContextFieldId(
  services: NonNullable<ReturnType<typeof getWorkflowServices>>,
  contextId: string,
  fieldReference: string,
): Promise<string> {
  const context = await services.decisionContextRepository.findById(contextId);
  if (!context) {
    throw new Error('Decision context not found');
  }

  const assignments = await services.templateFieldAssignmentRepository.findByTemplateId(context.templateId);
  const assignedFieldIds = new Set(assignments.map((assignment) => assignment.fieldId));

  if (assignedFieldIds.has(fieldReference)) {
    return fieldReference;
  }

  const field = await services.decisionFieldService.getFieldByIdentity({ name: fieldReference });
  if (!field) {
    throw new Error(`Field ${fieldReference} not found`);
  }

  if (!assignedFieldIds.has(field.id)) {
    throw new Error(`Field ${field.id} is not assigned to template ${context.templateId}`);
  }

  return field.id;
}

// Create OpenAPI Hono app
const app = new OpenAPIHono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Routes
app.openapi(createMeetingRoute, async (c) => {
  try {
    const data = c.req.valid('json');
    const meeting = await meetingService.create(data);
    return c.json(meeting, 201);
  } catch (error) {
    console.error('Error creating meeting:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.openapi(listMeetingsRoute, async (c) => {
  const meetings = await meetingService.findAll();
  return c.json({ meetings });
});

app.openapi(getMeetingRoute, async (c) => {
  const { id } = c.req.valid('param');
  const meeting = await meetingService.findById(id);
  
  if (!meeting) {
    return c.json({ error: 'Meeting not found' }, 404);
  }
  
  return c.json(meeting);
});

app.openapi(uploadTranscriptRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const uploadPayload: {
      meetingId: string;
      source: 'upload';
      format: 'json' | 'txt' | 'vtt' | 'srt';
      content: string;
      metadata?: Record<string, any>;
      uploadedBy?: string;
    } = {
      meetingId: id,
      source: 'upload',
      format: data.format,
      content: data.content,
    };
    if (data.metadata !== undefined) {
      uploadPayload.metadata = data.metadata;
    }
    if (data.uploadedBy !== undefined) {
      uploadPayload.uploadedBy = data.uploadedBy;
    }

    const transcript = await services.transcriptService.uploadTranscript(uploadPayload);
    const chunkOptions: {
      strategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
      maxTokens?: number;
      overlap?: number;
    } = {
      strategy: data.chunkStrategy,
    };
    if (data.chunkSize !== undefined) {
      chunkOptions.maxTokens = data.chunkSize;
    }
    if (data.overlap !== undefined) {
      chunkOptions.overlap = data.overlap;
    }

    const chunks = await services.transcriptService.processTranscript(transcript.id, chunkOptions);

    return c.json({ transcript, chunks }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.openapi(createFlaggedDecisionRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const createDecisionPayload: {
      meetingId: string;
      suggestedTitle: string;
      contextSummary: string;
      confidence: number;
      chunkIds: string[];
      suggestedTemplateId?: string;
      templateConfidence?: number;
      priority: number;
    } = {
      meetingId: id,
      suggestedTitle: data.suggestedTitle,
      contextSummary: data.contextSummary,
      confidence: data.confidence,
      chunkIds: data.chunkIds,
      priority: data.priority,
    };
    if (data.suggestedTemplateId !== undefined) {
      createDecisionPayload.suggestedTemplateId = data.suggestedTemplateId;
    }
    if (data.templateConfidence !== undefined) {
      createDecisionPayload.templateConfidence = data.templateConfidence;
    }

    const decision = await services.flaggedDecisionService.createFlaggedDecision(createDecisionPayload);

    return c.json(decision, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.openapi(createDecisionContextRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const data = c.req.valid('json');
    const context = await services.decisionContextService.createContext(data);
    return c.json(context, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.openapi(generateDraftRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const guidance: GuidanceSegment[] | undefined = data.guidance?.map((segment) => {
      if (segment.fieldId !== undefined) {
        return {
          fieldId: segment.fieldId,
          content: segment.content,
          source: segment.source,
        };
      }

      return {
        content: segment.content,
        source: segment.source,
      };
    });
    const context = await services.draftGenerationService.generateDraft(id, guidance);
    return c.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return c.json({ error: message }, status as 400 | 404);
  }
});

app.openapi(exportMarkdownRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id } = c.req.valid('param');
    const query = c.req.valid('query');
    const exportOptions: {
      includeMetadata?: boolean;
      includeTimestamps?: boolean;
      includeParticipants?: boolean;
      fieldOrder?: 'template' | 'alphabetical';
      lockedFieldIndicator?: 'prefix' | 'suffix' | 'none';
    } = {};
    if (query.includeMetadata !== undefined) {
      exportOptions.includeMetadata = query.includeMetadata;
    }
    if (query.includeTimestamps !== undefined) {
      exportOptions.includeTimestamps = query.includeTimestamps;
    }
    if (query.includeParticipants !== undefined) {
      exportOptions.includeParticipants = query.includeParticipants;
    }
    if (query.fieldOrder !== undefined) {
      exportOptions.fieldOrder = query.fieldOrder;
    }
    if (query.lockedFieldIndicator !== undefined) {
      exportOptions.lockedFieldIndicator = query.lockedFieldIndicator;
    }

    const markdown = await services.markdownExportService.exportToMarkdown(id, exportOptions);
    return c.json({ markdown });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return c.json({ error: message }, status as 400 | 404);
  }
});

app.openapi(lockFieldRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  const { id } = c.req.valid('param');
  const { fieldId } = c.req.valid('json');
  const context = await services.decisionContextService.lockField(id, fieldId);

  if (!context) {
    return c.json({ error: 'Decision context not found' }, 404);
  }

  return c.json(context);
});

app.openapi(unlockFieldRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  const { id } = c.req.valid('param');
  const { fieldId } = c.req.valid('json');
  const context = await services.decisionContextService.unlockField(id, fieldId);

  if (!context) {
    return c.json({ error: 'Decision context not found' }, 404);
  }

  return c.json(context);
});

app.openapi(listDraftVersionsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  const { id } = c.req.valid('param');
  const versions = await services.decisionContextService.listVersions(id);
  return c.json({ versions });
});

app.openapi(rollbackDraftRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id } = c.req.valid('param');
    const { version } = c.req.valid('json');
    const context = await services.decisionContextService.rollback(id, version);
    if (!context) {
      return c.json({ error: 'Decision context not found' }, 404);
    }

    return c.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return c.json({ error: message }, status as 400 | 404);
  }
});

app.openapi(regenerateFieldRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id, fieldId } = c.req.valid('param');
    const resolvedFieldId = await resolveContextFieldId(services, id, fieldId);
    const { guidance } = c.req.valid('json');
    const normalizedGuidance: GuidanceSegment[] | undefined = guidance?.map((segment) => {
      if (segment.fieldId === undefined) {
        return {
          content: segment.content,
          source: segment.source,
        };
      }

      return {
        fieldId: segment.fieldId,
        content: segment.content,
        source: segment.source,
      };
    });
    const value = await services.draftGenerationService.regenerateField(id, resolvedFieldId, normalizedGuidance);
    return c.json({ value });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return c.json({ error: message }, status as 400 | 404);
  }
});

app.openapi(updateFieldValueRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id, fieldId } = c.req.valid('param');
    const resolvedFieldId = await resolveContextFieldId(services, id, fieldId);
    const { value } = c.req.valid('json');
    const context = await services.decisionContextService.setFieldValue(id, resolvedFieldId, value);

    if (!context) {
      return c.json({ error: 'Decision context not found' }, 404);
    }

    return c.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return c.json({ error: message }, status as 400 | 404);
  }
});

app.openapi(getFieldTranscriptRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  const { id, fieldId } = c.req.valid('param');
  try {
    const resolvedFieldId = await resolveContextFieldId(services, id, fieldId);
    const chunks = await services.transcriptService.getChunksByContext(`decision:${id}:${resolvedFieldId}`);
    return c.json({ chunks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return c.json({ error: message }, status as 400 | 404);
  }
});

app.openapi(logDecisionRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  try {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');
    const decision = await services.decisionLogGenerator.logDecision(id, {
      loggedBy: payload.loggedBy,
      decisionMethod: payload.decisionMethod.details === undefined
        ? { type: payload.decisionMethod.type }
        : {
            type: payload.decisionMethod.type,
            details: payload.decisionMethod.details,
          },
    });
    if (!decision) {
      return c.json({ error: 'Decision context not found' }, 404);
    }

    return c.json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return c.json({ error: message }, status as 400 | 404);
  }
});

app.openapi(getDecisionLogRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  const { id } = c.req.valid('param');
  const decision = await services.decisionLogService.getDecisionLog(id);
  if (!decision) {
    return c.json({ error: 'Decision log not found' }, 404);
  }

  return c.json(decision);
});

app.openapi(exportDecisionLogRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  const { id } = c.req.valid('param');
  const { format } = c.req.valid('query');
  const decision = await services.decisionLogService.getDecisionLog(id);
  if (!decision) {
    return c.json({ error: 'Decision log not found' }, 404);
  }

  if (format === 'json') {
    return c.json({ format, content: decision });
  }

  const markdown = await services.markdownExportService.exportToMarkdown(decision.decisionContextId);

  return c.json({ format, content: markdown });
});

app.openapi(listLLMInteractionsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: 'This endpoint requires DATABASE_URL to be configured' }, 503);
  }

  const { id } = c.req.valid('param');
  const interactions = await services.llmInteractionService.findByDecisionContext(id);
  return c.json({ interactions });
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Decision Logger API',
    description: 'Context-driven decision logging system API',
  },
});

// Swagger UI
app.get('/docs', (c) => {
  return c.html(`
<!DOCTYPE html>
<html>
<head>
  <title>Decision Logger API</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
  `);
});

export { app };
export default app;

// Start server if not imported (direct run)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const port = process.env.PORT || 3000;
  console.log(`Server starting on port ${port}...`);
  
  // Use Node.js http server with Hono's fetch handler
  const server = (await import('http')).createServer(async (req, res) => {
    // Read request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    
    // Convert Node request to Web Request
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const headers = new Headers(
      Object.entries(req.headers)
        .filter(([, v]) => v !== undefined) 
        .map(([k, v]) => [k, v]) as [string, string][]
    );
    
    const request = new Request(url, {
      method: req.method || 'GET',
      headers,
      body: body.length > 0 ? body : null,
    });
    
    // Call Hono app
    const response = await app.fetch(request);
    
    // Convert Web Response to Node response
    res.statusCode = response.status;
    res.statusMessage = response.statusText;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const responseBody = await response.text();
    res.end(responseBody);
  });
  
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

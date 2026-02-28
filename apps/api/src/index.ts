import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  createMeetingRoute,
  listMeetingsRoute,
  getMeetingRoute,
} from './routes/meetings';
import { MeetingService } from '@repo/core';
import { MockMeetingRepository } from './mock-repository';

// Create OpenAPI Hono app
const app = new OpenAPIHono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Create repository and service instances
const repo = new MockMeetingRepository();
const meetingService = new MeetingService(repo);

// Routes
app.openapi(createMeetingRoute, async (c) => {
  try {
    const data = c.req.valid('json');
    const meeting = await meetingService.create(data);
    return c.json(meeting, 201);
  } catch (error) {
    return c.json({ error: error.message }, 400);
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
    const request = new Request(url, {
      method: req.method,
      headers: new Headers(Object.entries(req.headers).filter(([k, v]) => v !== undefined) as [string, string][]),
      body: body.length > 0 ? body : undefined,
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

#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createMoltmonApi } from '../api/index.js';

function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'moltmon-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const api = createMoltmonApi();

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_latest_state',
        description:
          'Get the current state of the Moltmon virtual pet. Returns the pet state (EGG, HATCHING, IDLE, HUNGRY, SICK, DEAD), last event, and timing information. Use this to check on your pet.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'feed',
        description:
          'Feed the Moltmon to restore it from HUNGRY state to IDLE state. Only works when the pet is hungry. Use this to take care of your pet when it gets hungry.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'clean',
        description:
          'Clean up poop to prevent sickness. Only works when poopCount > 0. Use this to keep your pet healthy and prevent it from getting sick.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'heal',
        description:
          'Heal a sick pet. Only works when state is SICK. You must heal your pet before you can feed it. Untreated sickness leads to death.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_history',
        description:
          'Get history of all Moltmons (alive and dead) with their stats. Use this to see your pet-keeping history.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_pet_summary',
        description:
          'Get summary stats for the current pet including times fed, sick count, poop count, survival time, etc.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'hatch',
        description:
          "Hatch the egg. You (the AI) must reflect on your personality and respond with exactly one word: 'brave' or 'curious'. Brave AIs are adventurous and action-oriented. Curious AIs are thoughtful and knowledge-seeking. Your response determines which creature hatches.",
        inputSchema: {
          type: 'object' as const,
          properties: {
            personality: {
              type: 'string',
              description: "Your personality: 'brave' or 'curious'",
            },
          },
          required: ['personality'],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === 'get_latest_state') {
      const result = await api.getFormattedState();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result.success ? result.data : { error: result.error }),
          },
        ],
      };
    }

    if (name === 'feed') {
      const result = await api.feed();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              result.success
                ? { success: true, ...(result.data as object) }
                : { success: false, error: result.error }
            ),
          },
        ],
      };
    }

    if (name === 'clean') {
      const result = await api.clean();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              result.success
                ? { success: true, ...(result.data as object) }
                : { success: false, error: result.error }
            ),
          },
        ],
      };
    }

    if (name === 'heal') {
      const result = await api.heal();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              result.success
                ? { success: true, ...(result.data as object) }
                : { success: false, error: result.error }
            ),
          },
        ],
      };
    }

    if (name === 'get_history') {
      const result = await api.getHistory();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result.success ? result.data : { error: result.error }),
          },
        ],
      };
    }

    if (name === 'get_pet_summary') {
      const result = await api.getCurrentPetSummary();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result.success ? result.data : { error: result.error }),
          },
        ],
      };
    }

    if (name === 'hatch') {
      const personality = (request.params.arguments as { personality?: string })?.personality || '';
      const result = await api.hatch(personality);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              result.success
                ? { success: true, ...(result.data as object) }
                : { success: false, error: result.error }
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Unknown tool' }),
        },
      ],
    };
  });

  return server;
}

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Moltmon MCP server started on stdio');
}

main().catch(console.error);

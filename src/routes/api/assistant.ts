import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/assistant')({
  server: { handlers: { POST: async ({ request }) => {
    const { handleAssistant } = await import('@/lib/assistant/chat.server');
    return handleAssistant(request);
  } } },
});
import { createFileRoute } from "@tanstack/react-router";
import { MessagesView } from "./messages";

// One chat, as a page of its own. Opened from the inbox (or a deep link); the
// back button returns to the inbox. The trailing underscore keeps it out of
// the /messages route's component, which doesn't render children.
export const Route = createFileRoute("/messages_/$chatId")({
  head: () => ({ meta: [{ title: "Chat — Oakmonte" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();
  return <MessagesView routeChatId={chatId} />;
}

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  customer_name?: string;
  customer_email?: string;
  status: string;
  last_message_at?: string;
  created_at: string;
}

interface Message {
  id: string;
  sender_type: string;
  sender_name?: string;
  message: string;
  created_at: string;
}

export function LiveChatTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [convo, setConvo] = useState<Conversation & { messages?: Message[] } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    setLoading(true);
    const res = await api.getChatConversations?.();
    setLoading(false);
    if (res?.success && res.data) setConversations(res.data);
  };

  const loadConversation = async (id: string) => {
    setSelectedId(id);
    const res = await api.getChatConversation?.(id);
    if (res?.success && res.data) setConvo(res.data);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedId) loadConversation(selectedId);
    else setConvo(null);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo?.messages]);

  const handleSend = async () => {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    const res = await api.sendChatMessage?.(selectedId, message.trim());
    setSending(false);
    if (res?.success) {
      setMessage("");
      loadConversation(selectedId);
      loadConversations();
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Live Chat</h2>
      <div className="grid md:grid-cols-3 gap-4 h-[500px]">
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border font-medium">Conversations</div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No conversations yet</div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-muted/50 transition",
                      selectedId === c.id && "bg-primary/10 border-l-4 border-l-primary"
                    )}
                  >
                    <p className="font-medium truncate">{c.customer_name || "Guest"}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.customer_email || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : new Date(c.created_at).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="md:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {convo ? (
            <>
              <div className="p-3 border-b border-border">
                <p className="font-medium">{convo.customer_name || "Customer"}</p>
                <p className="text-sm text-muted-foreground">{convo.customer_email || "—"}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(convo.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.sender_type === "seller" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        m.sender_type === "seller"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-xs opacity-80">{m.sender_name}</p>
                      <p className="text-sm">{m.message}</p>
                      <p className="text-xs opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-lg border border-border bg-background"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                  {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

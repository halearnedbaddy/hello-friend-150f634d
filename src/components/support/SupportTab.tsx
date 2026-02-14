import { useState, useEffect } from "react";
import { HelpCircle, Plus, Send, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  subject: string;
  category?: string;
  priority: string;
  status: string;
  created_at: string;
}

interface SupportMessage {
  id: string;
  sender_id: string;
  is_staff: boolean;
  message: string;
  created_at: string;
}

export function SupportTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<(Ticket & { messages?: SupportMessage[] }) | null>(null);
  const [message, setMessage] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    const res = await api.getSupportTickets?.();
    setLoading(false);
    if (res?.success && res.data) setTickets(res.data);
  };

  const loadTicket = async (id: string) => {
    setSelectedId(id);
    const res = await api.getSupportTicket?.(id);
    if (res?.success && res.data) setTicket(res.data);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedId) loadTicket(selectedId);
    else setTicket(null);
  }, [selectedId]);

  const handleCreate = async () => {
    if (!newSubject.trim()) return;
    setSending(true);
    const res = await api.createSupportTicket?.({
      subject: newSubject.trim(),
      message: newMessage.trim() || undefined,
    });
    setSending(false);
    if (res?.success && res.data) {
      setShowNew(false);
      setNewSubject("");
      setNewMessage("");
      loadTickets();
      loadTicket(res.data.id);
    } else {
      alert(res?.error || "Failed to create ticket");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    const res = await api.addSupportMessage?.(selectedId, message.trim());
    setSending(false);
    if (res?.success) {
      setMessage("");
      loadTicket(selectedId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Support</h2>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          <Plus size={18} />
          New Ticket
        </button>
      </div>

      {showNew && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold">Create Support Ticket</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full px-4 py-2 rounded-lg border border-border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-border"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={sending || !newSubject.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
              {sending ? "Creating..." : "Create Ticket"}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-muted rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-3 border-b border-border font-medium">Your Tickets</div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <HelpCircle size={32} className="mx-auto mb-2 opacity-50" />
                No tickets yet. Create one to get help.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => loadTicket(t.id)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-muted/50 transition",
                      selectedId === t.id && "bg-primary/10"
                    )}
                  >
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.status} • {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="md:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {ticket ? (
            <>
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">{ticket.subject}</h3>
                <p className="text-sm text-muted-foreground">
                  Status: {ticket.status} • Created {new Date(ticket.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
                {(ticket.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-lg p-3",
                      m.is_staff ? "bg-primary/10 ml-8" : "bg-muted mr-8"
                    )}
                  >
                    <p className="text-xs font-medium mb-1">{m.is_staff ? "Support" : "You"}</p>
                    <p className="text-sm">{m.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Add a message..."
                  className="flex-1 px-4 py-2 rounded-lg border border-border"
                />
                <button
                  onClick={handleSendMessage}
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
                <HelpCircle size={48} className="mx-auto mb-2 opacity-50" />
                <p>Select a ticket or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

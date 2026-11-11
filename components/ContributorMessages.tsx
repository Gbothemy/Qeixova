"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import ContributorLoading from "@/components/ContributorLoading";

type Conversation = { id: number; other_id: number; other_name: string; last_message: string | null; last_message_at: string | null; unread_count: number; request_status: "pending" | "accepted"; initiated_by: number };
type Person = { id: number; full_name: string };
type Message = { id: number; sender_id: number; body: string; created_at: string; read_at: string | null };

async function readJson(response: Response) { return response.json().catch(() => ({})); }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "Q"; }
function shortTime(value: string | null) {
  if (!value) return "Start a conversation";
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString() ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
function fullTime(value: string) { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export default function ContributorMessages() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [inboxView, setInboxView] = useState<"chats" | "requests">("chats");
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<{ id: number; name: string; requestStatus: "pending" | "accepted"; initiatedBy: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showPeople, setShowPeople] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showThreadMenu, setShowThreadMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const stickToLatestRef = useRef(true);
  const handledDeepLink = useRef(false);
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;

  const loadInbox = useCallback(async () => {
    const response = await fetch("/api/contributor/messages", { cache: "no-store" }).catch(() => null);
    if (!response) { setError("Messages could not connect. Check your connection and try again."); setLoading(false); return; }
    const data = await readJson(response);
    if (!response.ok) { setError(data.error || "Messages could not load."); setLoading(false); return; }
    setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    setRequests(Array.isArray(data.requests) ? data.requests : []);
    setPeople(Array.isArray(data.people) ? data.people : []);
    setError(""); setLoading(false);
  }, []);

  const loadThread = useCallback(async (conversationId: number, showLoader = false) => {
    if (showLoader) setThreadLoading(true);
    const response = await fetch(`/api/contributor/messages?conversationId=${conversationId}`, { cache: "no-store" }).catch(() => null);
    const data = response ? await readJson(response) : {};
    if (!response?.ok) { setError(data.error || "This conversation could not be loaded."); setThreadLoading(false); return; }
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setOther(data.conversation ? { id: Number(data.conversation.other_id), name: data.conversation.other_name, requestStatus: data.conversation.request_status, initiatedBy: Number(data.conversation.initiated_by) } : null);
    setThreadLoading(false);
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation));
  }, []);

  const startConversationById = useCallback(async (recipientId: number, sourcePostId?: number) => {
    setError("");
    const response = await fetch("/api/contributor/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", recipientId, sourcePostId }) }).catch(() => null);
    const data = response ? await readJson(response) : {};
    if (!response?.ok) { setError(data.error || "Could not start that conversation."); return; }
    setShowPeople(false); setSearch("");
    await loadInbox();
    setSelected(Number(data.conversationId));
    setInboxView(data.requestStatus === "pending" ? "chats" : "chats");
  }, [loadInbox]);
  useEffect(() => { if (user) void loadInbox(); }, [user, loadInbox]);
  useEffect(() => {
    if (!user || loading || handledDeepLink.current) return;
    const params = new URLSearchParams(window.location.search);
    const recipientId = Number(params.get("to"));
    if (!Number.isSafeInteger(recipientId) || recipientId <= 0) return;
    handledDeepLink.current = true;
    const sourcePostId = Number(params.get("post"));
    void startConversationById(recipientId, Number.isSafeInteger(sourcePostId) && sourcePostId > 0 ? sourcePostId : undefined);
  }, [user, loading, startConversationById]);
  useEffect(() => {
    if (!selected) return;
    void loadThread(selected, true);
  }, [selected, loadThread]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!user) return;
      void loadInbox();
      if (selectedRef.current) void loadThread(selectedRef.current);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [user, loadInbox, loadThread]);
  useEffect(() => { if (selected) stickToLatestRef.current = true; if (stickToLatestRef.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, selected]);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people.filter((person) => (!query || person.full_name.toLowerCase().includes(query)) && !conversations.some((conversation) => Number(conversation.other_id) === Number(person.id))).slice(0, 30);
  }, [people, search, conversations]);

  const startConversation = async (person: Person) => {
    await startConversationById(person.id);
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selected || !body || sending) return;
    setSending(true); setError("");
    const response = await fetch("/api/contributor/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", conversationId: selected, body }) }).catch(() => null);
    const data = response ? await readJson(response) : {};
    setSending(false);
    if (!response?.ok) { setError(data.error || "Your message could not be sent. Try again."); return; }
    setDraft("");
    setMessages((current) => [...current, data.message]);
    void loadInbox();
  };

  const respondToRequest = async (action: "accept" | "ignore" | "block") => {
    if (!selected) return;
    setError("");
    const response = await fetch("/api/contributor/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, conversationId: selected }) }).catch(() => null);
    const data = response ? await readJson(response) : {};
    if (!response?.ok) { setError(data.error || "Could not update this message request."); return; }
    await loadInbox();
    if (action === "accept") await loadThread(selected);
    else { setSelected(null); setOther(null); setMessages([]); setInboxView("chats"); }
  };

  const blockCurrentConversation = async () => {
    if (!selected) return;
    const response = await fetch("/api/contributor/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "block", conversationId: selected }) }).catch(() => null);
    const data = response ? await readJson(response) : {};
    if (!response?.ok) { setError(data.error || "This contributor could not be blocked."); return; }
    setSelected(null); setOther(null); setMessages([]); setShowThreadMenu(false);
    await loadInbox();
  };

  if (authLoading || loading) return <ContributorLoading label="Loading messages" detail="Opening your contributor inbox." />;

  const activeConversation = conversations.find((conversation) => conversation.id === selected);
  const activeRequest = requests.find((conversation) => conversation.id === selected);
  const isIncomingRequest = other?.requestStatus === "pending" && other.initiatedBy !== user?.id;
  const isOutgoingRequest = other?.requestStatus === "pending" && other.initiatedBy === user?.id;
  const visibleConversations = inboxView === "requests" ? requests : conversations;
  const filteredConversations = visibleConversations.filter((conversation) => !search.trim() || conversation.other_name.toLowerCase().includes(search.trim().toLowerCase()) || (conversation.last_message || "").toLowerCase().includes(search.trim().toLowerCase()));
  const suggestedPeople = inboxView === "chats" ? filteredPeople.slice(0, 8) : [];

  return (
    <main className="page-body messagesPage">
      <header className="messagesHeading"><div><span className="messagesEyebrow">CONTRIBUTOR COMMUNITY</span><h1>Messages</h1><p>Chat with mutual follows, or reply when someone messages you from a post.</p></div><button type="button" className="newMessageButton" onClick={() => setShowPeople((current) => !current)} aria-expanded={showPeople}>＋ New message</button></header>
      {error ? <div className="messagesAlert" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss">×</button></div> : null}
      <section className="messagesWorkspace" aria-label="Contributor messages">
        <aside className={`messageInbox${selected ? " hasSelection" : ""}`}>
          <div className="inboxHeader"><div className="inboxHeadingStart"><Link className="inboxBack" href="/creator" aria-label="Back to Home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg></Link><div><h2>Chat</h2><span>{conversations.length} conversations</span></div></div><div className="inboxHeaderActions"><button type="button" className="inboxFilter" onClick={() => setInboxView((view) => view === "chats" ? "requests" : "chats")} aria-label={`Show ${inboxView === "chats" ? "message requests" : "all chats"}`}>{inboxView === "chats" ? "All" : "Requests"}</button><button type="button" className="newChatIcon" onClick={() => setShowPeople((current) => !current)} aria-label="Start a new chat" aria-expanded={showPeople}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 8v6M17 11h6"/></svg></button></div></div>
          <label className="inboxSearch"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" aria-label="Search chats" /></label>
          <div className="inboxTabs" role="tablist" aria-label="Message inbox"><button type="button" role="tab" aria-selected={inboxView === "chats"} className={inboxView === "chats" ? "active" : ""} onClick={() => setInboxView("chats")}>Chats</button><button type="button" role="tab" aria-selected={inboxView === "requests"} className={inboxView === "requests" ? "active" : ""} onClick={() => setInboxView("requests")}>Requests{requests.length ? <b>{requests.length}</b> : null}</button></div>
          {showPeople ? <div className="peoplePicker"><label htmlFor="people-search">People you both follow</label><input id="people-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a mutual follow…" autoComplete="off" />
            <div className="peopleResults">{filteredPeople.map((person) => <div className="peopleResult" key={person.id}><Link className="messageAvatar messageAvatarLink" href={`/profile/${person.id}`} aria-label={`Open ${person.full_name}'s profile`}>{initials(person.full_name)}</Link><button type="button" onClick={() => void startConversation(person)}><span><strong>{person.full_name}</strong><small>Contributor</small></span><b>›</b></button></div>)}{filteredPeople.length === 0 ? <p>{people.length ? "No more contributors found." : "No verified contributors to show yet."}</p> : null}</div>
          </div> : null}
          <div className="conversationList">{filteredConversations.map((conversation) => <div key={conversation.id} className={`conversationItem${selected === conversation.id ? " selected" : ""}`}>
            <Link className="messageAvatar messageAvatarLink" href={`/profile/${conversation.other_id}`} aria-label={`Open ${conversation.other_name}'s profile`}>{initials(conversation.other_name)}</Link><button type="button" className="conversationSelect" onClick={() => { setShowPeople(false); setSelected(conversation.id); }}><span className="conversationCopy"><strong>{conversation.other_name}</strong><small>{conversation.last_message || "Say hello to start chatting"}</small></span><span className="conversationMeta"><time>{shortTime(conversation.last_message_at)}</time>{Number(conversation.unread_count) > 0 ? <b>{conversation.unread_count}</b> : null}</span></button>
          </div>)}{filteredConversations.length === 0 && !showPeople ? <div className="inboxEmpty"><span>✉</span><strong>{inboxView === "requests" ? "No message requests" : "No conversations yet"}</strong><p>{inboxView === "requests" ? "Requests from contributors you do not follow back will appear here." : "Follow each other to start a chat, or message someone from one of their posts."}</p>{inboxView === "chats" ? <button type="button" onClick={() => setShowPeople(true)}>Find mutual follows</button> : null}</div> : null}
            {suggestedPeople.length ? <section className="suggestedChats"><h3>Suggested</h3>{suggestedPeople.map((person) => <div className="suggestedChat" key={person.id}><Link className="messageAvatar messageAvatarLink" href={`/profile/${person.id}`} aria-label={`Open ${person.full_name}'s profile`}>{initials(person.full_name)}</Link><span><strong>{person.full_name}</strong><small>You follow each other</small></span><button type="button" onClick={() => void startConversation(person)}>Chat</button></div>)}</section> : null}
          </div>
          <div className="inboxPrivacy"><span>◎</span> Private chats are for contributors only</div>
        </aside>

        <section className={`messageThread${selected ? " isActive" : ""}`} aria-label="Conversation">
          {selected && other ? <>
            <header className="threadHeader"><button type="button" className="threadBack" onClick={() => setSelected(null)} aria-label="Back to inbox">‹</button><Link className="messageAvatar messageAvatarLink" href={`/profile/${other.id}`} aria-label={`Open ${other.name}'s profile`}>{initials(other.name)}</Link><div><strong>{other.name}</strong><small><svg className="threadLock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg> Standard chat · not end-to-end encrypted</small></div><button type="button" className="threadMore" aria-label="Conversation options" aria-expanded={showThreadMenu} onClick={() => setShowThreadMenu((value) => !value)}>•••</button>{showThreadMenu ? <div className="threadOptions"><button type="button" onClick={() => void blockCurrentConversation()}>Block contributor</button></div> : null}</header>
            <div className="threadMessages" onScroll={(event) => { const element = event.currentTarget; stickToLatestRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>{threadLoading ? <div className="threadLoading">Loading conversation…</div> : messages.length ? messages.map((message, index) => {
              const mine = Number(message.sender_id) === user?.id;
              const thisDay = new Date(message.created_at).toDateString();
              const previousDay = index > 0 ? new Date(messages[index - 1].created_at).toDateString() : "";
              return <div className="messageGroup" key={message.id}>{thisDay !== previousDay ? <div className="messageDate">{new Date(message.created_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div> : null}<div className={`messageRow${mine ? " mine" : ""}`}><div className="messageBubble">{message.body}<time>{fullTime(message.created_at)}{mine && message.read_at ? " · Read" : ""}</time></div></div></div>;
            }) : <div className="threadStart"><span>✦</span><strong>Start the conversation</strong><p>Send {other.name.split(" ")[0]} a friendly hello.</p></div>}<div ref={endRef} /></div>
            {isIncomingRequest ? <div className="requestPanel"><strong>Message request</strong><p>{other.name} reached out from a post. Accept to continue chatting. They won’t know you read it until you accept.</p><div><button type="button" className="acceptRequest" onClick={() => void respondToRequest("accept")}>Accept</button><button type="button" onClick={() => void respondToRequest("ignore")}>Ignore</button><button type="button" className="blockRequest" onClick={() => void respondToRequest("block")}>Block</button></div></div> : isOutgoingRequest && messages.length > 0 ? <div className="requestPending">Message request sent · You can send more messages after they accept.</div> : <form className="messageComposer" onSubmit={sendMessage}><button type="button" className="emojiToggle" aria-label="Add emoji" aria-expanded={showEmoji} onClick={() => setShowEmoji((value) => !value)}>☺</button>{showEmoji ? <div className="emojiPicker">{["😀", "😊", "😂", "❤️", "👍", "🎉", "🙏", "✨"].map((emoji) => <button type="button" key={emoji} aria-label={`Add ${emoji}`} onClick={() => { setDraft((value) => `${value}${emoji}`); setShowEmoji(false); }}>{emoji}</button>)}</div> : null}<textarea value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder={isOutgoingRequest ? "Write your message request…" : "Unencrypted message"} aria-label="Write a message" /><button type="submit" className="sendMessageButton" disabled={sending || !draft.trim()} aria-label="Send message">{sending ? "…" : "↑"}</button></form>}
          </> : <div className="threadWelcome"><div className="welcomeIcon">✉</div><h2>Your conversations, together.</h2><p>Choose a contributor from your inbox, follow each other to connect, or message someone from their post.</p><button type="button" onClick={() => setShowPeople(true)}>＋ Message mutual follows</button></div>}
        </section>
      </section>
      <p className="messagesFooterNote">Messages are limited to verified contributors. Keep conversations kind and respectful.</p>
      <style jsx>{`
        .messagesPage{width:min(100%,1120px);margin:0 auto;padding-top:30px;padding-bottom:105px;color:var(--text)}.messagesHeading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}.messagesEyebrow{color:#318d5b;font-size:10px;font-weight:850;letter-spacing:.13em}.messagesHeading h1{margin:7px 0 5px;font-size:32px;letter-spacing:-.045em}.messagesHeading p{color:var(--muted);font-size:13px}.newMessageButton{padding:10px 14px;border:0;border-radius:10px;background:#2f9b5a;color:#fff;font-size:12px;font-weight:800;cursor:pointer}.messagesAlert{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;padding:11px 13px;border:1px solid #efc0ba;border-radius:11px;background:#fff4f2;color:#973d33;font-size:12px}.messagesAlert button{border:0;background:none;color:inherit;font-size:19px;cursor:pointer}
        .messagesWorkspace{display:grid;grid-template-columns:320px minmax(0,1fr);height:min(680px,calc(100vh - 250px));min-height:470px;overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--bg);box-shadow:0 10px 30px rgba(28,44,60,.06)}.messageInbox{position:relative;display:flex;min-width:0;flex-direction:column;border-right:1px solid var(--border);background:var(--bg)}.inboxHeader{display:flex;align-items:center;justify-content:space-between;padding:17px 16px 13px;border-bottom:1px solid var(--border)}.inboxHeadingStart{display:flex;align-items:center;gap:10px;min-width:0}.inboxBack{display:none}.inboxHeadingStart>div{display:grid;gap:3px}.inboxHeadingStart>div>span{display:none}.inboxHeader h2{font-size:16px}.inboxHeader span{display:block;margin-top:3px;color:var(--muted);font-size:10px}.inboxHeader button{width:31px;height:31px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:#2e9258;font-size:20px;cursor:pointer}.inboxTabs{display:flex;gap:4px;padding:9px 12px;border-bottom:1px solid var(--border)}.inboxTabs button{display:flex;align-items:center;gap:6px;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:var(--muted);font-size:11px;font-weight:750;cursor:pointer}.inboxTabs button.active{background:#eaf5ed;color:#267847}.inboxTabs b{display:grid;place-items:center;min-width:16px;height:16px;padding:0 4px;border-radius:99px;background:#2e9258;color:white;font-size:9px}.conversationList{flex:1;overflow-y:auto}.conversationItem{display:flex;width:100%;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid color-mix(in srgb,var(--border) 70%,transparent);background:transparent;color:var(--text);text-align:left}.conversationSelect{display:flex;min-width:0;flex:1;align-items:center;gap:10px;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.conversationSelect:focus-visible{outline:2px solid #2e9955;outline-offset:3px;border-radius:8px}.messageAvatarLink{color:#28774a;text-decoration:none;transition:box-shadow .15s,transform .15s}.messageAvatarLink:hover{box-shadow:0 0 0 3px #2e995533;transform:scale(1.04)}.threadHeader .messageAvatarLink{flex:0 0 48px}.conversationItem:hover,.conversationItem.selected{background:color-mix(in srgb,#eaf4ed 60%,var(--bg))}.messageAvatar{display:grid;place-items:center;flex:0 0 39px;width:39px;height:39px;border-radius:50%;background:#e5f2e9;color:#28774a;font-size:11px;font-weight:800}.conversationCopy{display:grid;min-width:0;flex:1;gap:5px}.conversationCopy strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.conversationCopy small{overflow:hidden;color:var(--muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.conversationMeta{display:grid;justify-items:end;align-self:stretch;gap:6px}.conversationMeta time{color:var(--muted);font-size:9px;white-space:nowrap}.conversationMeta b{display:grid;place-items:center;min-width:17px;height:17px;padding:0 5px;border-radius:99px;background:#318f58;color:white;font-size:9px}.inboxEmpty{display:grid;justify-items:center;gap:8px;padding:40px 20px;text-align:center}.inboxEmpty>span{color:#3b9c60;font-size:25px}.inboxEmpty strong{font-size:13px}.inboxEmpty p{color:var(--muted);font-size:11px;line-height:1.45}.inboxEmpty button{margin-top:4px;padding:8px 11px;border:1px solid #cce3d3;border-radius:9px;background:#f0f8f2;color:#28774a;font-size:10px;font-weight:750;cursor:pointer}.inboxPrivacy{display:flex;align-items:center;gap:7px;padding:11px 14px;border-top:1px solid var(--border);color:var(--muted);font-size:9px}.inboxPrivacy span{color:#378a59}
        .peoplePicker{position:absolute;z-index:5;inset:65px 8px auto;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--bg);box-shadow:0 15px 32px rgba(15,35,50,.16)}.peoplePicker>label{display:block;margin-bottom:8px;font-size:11px;font-weight:800}.peoplePicker>input{width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text);font:inherit;font-size:11px;outline:none}.peoplePicker>input:focus{border-color:#57a878}.peopleResults{max-height:260px;overflow:auto;margin-top:7px}.peopleResult{display:flex;align-items:center;gap:9px;padding:9px 3px;border-bottom:1px solid var(--border)}.peopleResult>.messageAvatar{width:32px;height:32px;flex-basis:32px;font-size:9px}.peopleResult>button{display:flex;min-width:0;flex:1;align-items:center;justify-content:space-between;gap:9px;padding:0;border:0;background:none;color:var(--text);text-align:left;cursor:pointer}.peopleResult>button:focus-visible{outline:2px solid #2e9955;outline-offset:2px;border-radius:6px}.peopleResult>button>span{display:grid;gap:3px}.peopleResults strong{font-size:11px}.peopleResults small,.peopleResults p{color:var(--muted);font-size:9px}.peopleResult>button>b{color:var(--muted);font-size:17px}
        .requestPanel{padding:13px 16px;border-top:1px solid var(--border);background:var(--bg)}.requestPanel>strong{font-size:12px}.requestPanel>p{margin:5px 0 11px;color:var(--muted);font-size:10px;line-height:1.5}.requestPanel>div{display:flex;gap:7px}.requestPanel button{padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:10px;font-weight:750;cursor:pointer}.requestPanel button.acceptRequest{border-color:#2e9258;background:#2e9258;color:white}.requestPanel button.blockRequest{margin-left:auto;color:#a33d37}.requestPending{padding:11px 15px;border-top:1px solid var(--border);background:#f4f8f4;color:var(--muted);font-size:10px;text-align:center}
        .messageThread{display:flex;min-width:0;min-height:0;overflow:hidden;flex-direction:column;background:color-mix(in srgb,#f7f9f8 72%,var(--bg))}.threadHeader{display:flex;align-items:center;gap:10px;min-height:70px;padding:12px 17px;border-bottom:1px solid var(--border);background:var(--bg)}.threadHeader>div{display:grid;gap:5px}.threadHeader>div>strong{font-size:12px}.threadHeader>div>small{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:10px}.threadHeader>div>small i{width:7px;height:7px;border-radius:50%;background:#42a665}.threadMore{margin-left:auto;color:var(--muted);letter-spacing:2px}.threadBack{display:none;width:28px;height:28px;border:0;border-radius:7px;background:var(--card-bg);color:var(--text);font-size:24px}.threadMessages{display:flex;min-height:0;flex:1 1 auto;flex-direction:column;gap:12px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:20px 24px}.messageRow{display:flex;justify-content:flex-start}.messageRow.mine{justify-content:flex-end}.messageBubble{max-width:min(78%,520px);padding:10px 12px;border:1px solid var(--border);border-radius:13px 13px 13px 4px;background:var(--bg);color:var(--text);font-size:12px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 2px 5px rgba(20,40,55,.025)}.messageRow.mine .messageBubble{border-color:#d2e8d8;border-radius:13px 13px 4px 13px;background:#eaf5ed}.messageBubble time{display:block;margin-top:5px;color:var(--muted);font-size:9px;text-align:right}.threadLoading{margin:auto;color:var(--muted);font-size:12px}.threadStart{display:grid;justify-items:center;gap:7px;margin:auto;text-align:center}.threadStart>span{color:#31945a;font-size:26px}.threadStart strong{font-size:13px}.threadStart p{color:var(--muted);font-size:11px}.threadWelcome{display:grid;justify-items:center;align-content:center;flex:1;padding:30px;text-align:center}.welcomeIcon{display:grid;place-items:center;width:64px;height:64px;margin-bottom:17px;border-radius:20px;background:#e7f3ea;color:#2d9255;font-size:27px}.threadWelcome h2{font-size:18px;letter-spacing:-.025em}.threadWelcome p{max-width:280px;margin:7px 0 16px;color:var(--muted);font-size:12px;line-height:1.55}.threadWelcome button{padding:10px 13px;border:0;border-radius:9px;background:#2f9b5a;color:white;font-size:11px;font-weight:800;cursor:pointer}.messageComposer{margin:0 17px 16px;padding:10px 11px;border:1px solid var(--border);border-radius:12px;background:var(--bg)}.messageComposer textarea{display:block;width:100%;min-height:48px;max-height:120px;resize:vertical;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:12px;line-height:1.5}.messageComposer>div{display:flex;align-items:center;justify-content:space-between;margin-top:6px}.messageComposer>div>span{color:var(--muted);font-size:9px}.messageComposer button{display:grid;place-items:center;width:31px;height:31px;border:0;border-radius:9px;background:#2f9b5a;color:white;font-size:19px;cursor:pointer}.messageComposer button:disabled{opacity:.4;cursor:not-allowed}.messagesFooterNote{margin-top:10px;color:var(--muted);font-size:10px;text-align:center}
        @media(max-width:760px){.messagesPage{padding:18px 12px 96px}.messagesHeading{align-items:flex-start}.messagesHeading h1{font-size:27px}.messagesHeading p{max-width:250px;font-size:11px}.newMessageButton{padding:9px 10px;font-size:10px;white-space:nowrap}.messagesWorkspace{grid-template-columns:1fr;height:calc(100dvh - 235px);min-height:470px}.messageInbox.hasSelection{display:none}.messageThread:not(.isActive){display:none}.threadBack{display:grid;place-items:center}.threadMessages{padding:16px}.messageComposer{margin:0 10px 10px}.messagesFooterNote{font-size:9px}}
        .messagesPage{width:100%;max-width:none;height:calc(100dvh - 24px);min-height:620px;margin:0;padding:0 0 16px;overflow:hidden;background:var(--bg)}.messagesHeading{display:none}.messagesWorkspace{grid-template-columns:minmax(330px,440px) minmax(0,1fr);width:min(100%,1240px);height:100%;min-height:0;margin:0 auto;border:0;border-radius:0;box-shadow:none}.messageInbox{border-right:1px solid var(--border)}.inboxHeader{min-height:66px;padding:12px 16px;border-bottom:0}.inboxHeader h2{font-size:22px;letter-spacing:-.03em}.inboxHeader>div>span{display:none}.inboxHeaderActions{display:flex;align-items:center;gap:8px}.inboxFilter{display:flex;align-items:center;gap:10px;padding:9px 13px;border:1px solid var(--border);border-radius:999px;background:var(--bg);color:var(--text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.newChatIcon{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:var(--card-bg);color:var(--text);cursor:pointer}.newChatIcon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.inboxSearch{display:flex;align-items:center;gap:10px;height:44px;margin:6px 16px 10px;padding:0 14px;border-radius:999px;background:var(--card-bg);color:var(--muted)}.inboxSearch>span{font-size:24px;line-height:1}.inboxSearch input{width:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:13px}.inboxTabs{padding:0 16px 9px;border-bottom:1px solid var(--border)}.inboxTabs button{padding:6px 11px;font-size:11px}.conversationList{padding:8px 8px 0}.conversationItem{min-height:80px;padding:10px;border:0;border-radius:14px}.conversationItem.selected,.conversationItem:hover{background:var(--card-bg)}.conversationItem .messageAvatar,.suggestedChat .messageAvatar{width:54px;height:54px;flex-basis:54px;font-size:13px}.conversationCopy{gap:6px}.conversationCopy strong,.suggestedChat strong{font-size:13px}.conversationCopy small,.suggestedChat small{font-size:12px}.conversationMeta time{font-size:10px}.suggestedChats{padding:8px 10px 12px}.suggestedChats h3{margin:5px 0 6px;font-size:13px}.suggestedChat{display:flex;align-items:center;gap:10px;min-height:84px;padding:9px 2px;border-bottom:1px solid var(--border)}.suggestedChat>span:nth-child(2){display:grid;min-width:0;flex:1;gap:5px}.suggestedChat strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.suggestedChat small{color:var(--muted)}.suggestedChat button{padding:8px 18px;border:0;border-radius:999px;background:var(--card-bg);color:var(--text);font-size:12px;font-weight:750;cursor:pointer}.inboxPrivacy{display:none}.messageThread{background:var(--bg)}.threadWelcome{align-content:center}.welcomeIcon{width:88px;height:88px;border-radius:50%;background:var(--card-bg);color:var(--text)}.welcomeIcon:before{content:"";width:43px;height:43px;background:currentColor;mask:url('/icon-chat.svg') center/contain no-repeat}.welcomeIcon{font-size:0}.threadWelcome h2{font-size:20px}.threadWelcome p{max-width:340px;font-size:14px}.threadWelcome button{padding:11px 18px;border-radius:999px;background:#111820;font-size:13px}.threadHeader{min-height:66px}.threadMessages{background:color-mix(in srgb,var(--card-bg) 45%,var(--bg))}.messageBubble{font-size:13px}.messageComposer{padding:12px;border-radius:16px}.messageComposer textarea{font-size:13px}.messagesFooterNote{display:none}
        @media(max-width:760px){.messagesPage{height:100dvh;min-height:0;padding:0}.messagesWorkspace{grid-template-columns:minmax(0,1fr);height:100%;min-height:0}.messageInbox{border-right:0}.messageInbox.hasSelection{display:none}.messageThread:not(.isActive){display:none}.inboxHeader{min-height:64px;padding:8px 12px}.inboxBack{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border:1px solid var(--border);border-radius:50%;background:var(--card-bg);color:var(--text);text-decoration:none}.inboxBack svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.inboxHeadingStart h2{font-size:21px}.inboxSearch{height:42px;margin:5px 13px 9px}.inboxTabs{padding-inline:12px}.conversationList{padding:6px 6px 0}.conversationItem{min-height:72px}.conversationItem .messageAvatar,.suggestedChat .messageAvatar{width:48px;height:48px;flex-basis:48px}.suggestedChat{min-height:72px}.messageThread.isActive{display:flex}.threadBack{display:grid;place-items:center}.threadMessages{padding:14px}.messageComposer{margin:0 10px 10px}.messagesFooterNote{display:none}}
        .threadHeader{position:relative;min-height:66px;padding:9px 18px}.threadHeader .messageAvatar{width:48px;height:48px;flex-basis:48px}.threadHeader>div{gap:2px}.threadHeader>div>strong{font-size:15px}.threadHeader>div>small{font-size:11px}.threadLock{display:inline!important;width:14px;height:14px;margin:0!important;fill:none;stroke:currentColor;stroke-width:1.5;vertical-align:-2px}.threadMore{display:grid;place-items:center;width:42px;height:42px;margin-left:auto;border:1px solid var(--border);border-radius:50%;background:var(--bg);font-size:16px;cursor:pointer}.threadOptions{position:absolute;z-index:10;top:56px;right:16px;padding:5px;border:1px solid var(--border);border-radius:10px;background:var(--bg);box-shadow:0 8px 24px rgba(20,35,45,.15)}.threadOptions button{padding:9px 12px;border:0;border-radius:6px;background:transparent;color:#a43c38;font:inherit;font-size:12px;white-space:nowrap;cursor:pointer}.threadOptions button:hover{background:#fff2f1}.threadMessages{gap:10px;padding:22px 18px}.messageGroup{display:contents}.messageDate{align-self:center;margin:28px 0 4px;color:var(--muted);font-size:11px;font-weight:650}.messageRow{width:100%}.messageBubble{max-width:min(78%,520px);padding:10px 15px;border:0;border-radius:20px 20px 20px 5px;background:var(--card-bg);font-size:14px;line-height:1.45}.messageRow.mine .messageBubble{border:0;border-radius:20px 20px 5px 20px;background:#1d9bf0;color:#fff}.messageRow.mine .messageBubble time{color:rgba(255,255,255,.75)}.messageComposer{position:relative;display:flex;align-items:center;gap:8px;margin:0 16px 14px;padding:7px 9px;border:0;border-radius:999px;background:var(--card-bg)}.messageComposer textarea{min-height:38px;max-height:88px;align-self:center;flex:1;padding:9px 2px;resize:none}.emojiToggle{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border:0;border-radius:50%;background:var(--bg);color:var(--text);font-size:22px;cursor:pointer}.sendMessageButton{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border:0;border-radius:50%;background:#1d9bf0;color:white;font-size:19px;cursor:pointer}.sendMessageButton:disabled{opacity:.4;cursor:not-allowed}.emojiPicker{position:absolute;z-index:10;right:48px;bottom:52px;display:grid;grid-template-columns:repeat(4,36px);gap:3px;padding:8px;border:1px solid var(--border);border-radius:12px;background:var(--bg);box-shadow:0 8px 24px rgba(20,35,45,.15)}.emojiPicker button{width:34px;height:34px;border:0;border-radius:7px;background:transparent;font-size:18px;cursor:pointer}.emojiPicker button:hover{background:var(--card-bg)}
      `}</style>
    </main>
  );
}

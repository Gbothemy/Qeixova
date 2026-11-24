import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureCreatorSchema, ensureMessagingSchema } from "@/lib/contributorFeatures";
import { sql } from "@/lib/db";
import { ensurePremiumSubscriptionTable } from "@/lib/premium";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await Promise.all([ensureMessagingSchema(), ensureCreatorSchema(), ensurePremiumSubscriptionTable()]);
    const attachmentId = Number(request.nextUrl.searchParams.get("attachmentId"));
    if (Number.isSafeInteger(attachmentId) && attachmentId > 0) {
      const rows = await sql`SELECT m.attachment_url, m.attachment_type, m.attachment_name FROM contributor_messages m
        JOIN contributor_conversations c ON c.id = m.conversation_id
        WHERE m.id = ${attachmentId} AND ${session.userId} IN (c.participant_low, c.participant_high) AND c.request_status <> 'declined'
          AND NOT EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high) OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low)) LIMIT 1`;
      const fileUrl = rows[0]?.attachment_url;
      const match = typeof fileUrl === "string" ? fileUrl.match(/^data:(image\/(?:jpeg|png|webp)|video\/(?:mp4|webm|quicktime)|application\/pdf|audio\/(?:webm|mp4|ogg));base64,([A-Za-z0-9+/=]+)$/) : null;
      if (!match) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      const bytes = Buffer.from(match[2], "base64");
      const fileName = encodeURIComponent(String(rows[0].attachment_name || "attachment").replace(/[\r\n]/g, ""));
      return new NextResponse(bytes, { headers: { "Content-Type": match[1], "Content-Disposition": `${rows[0].attachment_type === "pdf" ? "attachment" : "inline"}; filename*=UTF-8''${fileName}`, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
    }
    if (request.nextUrl.searchParams.get("callEvents") === "1" && !request.nextUrl.searchParams.get("conversationId")) {
      const after = Math.max(0, Number(request.nextUrl.searchParams.get("after")) || 0);
      const events = await sql`SELECT s.id, s.call_id, s.conversation_id, s.sender_id, s.signal_type, s.payload, s.created_at FROM contributor_call_signals s
        JOIN contributor_conversations c ON c.id = s.conversation_id
        WHERE s.recipient_id = ${session.userId} AND s.id > ${after} AND s.created_at > NOW() - INTERVAL '1 day' AND c.request_status = 'accepted'
          AND NOT EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high) OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low))
        ORDER BY s.id ASC LIMIT 100`;
      return NextResponse.json({ events: events.map((event) => ({ ...event, id: Number(event.id), conversation_id: Number(event.conversation_id), sender_id: Number(event.sender_id) })) });
    }
    const conversationId = Number(request.nextUrl.searchParams.get("conversationId"));
    if (Number.isSafeInteger(conversationId) && conversationId > 0) {
      const access = await sql`
        SELECT c.id, c.created_at AS conversation_created_at, c.request_status, c.initiated_by,
          CASE WHEN c.participant_low = ${session.userId} THEN high.id ELSE low.id END AS other_id,
          CASE WHEN c.participant_low = ${session.userId} THEN high.full_name ELSE low.full_name END AS other_name,
          CASE WHEN c.participant_low = ${session.userId} THEN high.avatar_url ELSE low.avatar_url END AS other_avatar_url,
          CASE WHEN c.participant_low = ${session.userId} THEN high.bio ELSE low.bio END AS other_bio,
          CASE WHEN c.participant_low = ${session.userId} THEN high.location ELSE low.location END AS other_location,
          CASE WHEN c.participant_low = ${session.userId} THEN high.occupation ELSE low.occupation END AS other_occupation,
          CASE WHEN c.participant_low = ${session.userId} THEN high.website ELSE low.website END AS other_website,
          CASE WHEN c.participant_low = ${session.userId}
            THEN EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = high.id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW()))
            ELSE EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = low.id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) END AS other_is_premium,
          EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high) OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low)) AS blocked
        FROM contributor_conversations c
        JOIN users low ON low.id = c.participant_low
        JOIN users high ON high.id = c.participant_high
        WHERE c.id = ${conversationId} AND ${session.userId} IN (c.participant_low, c.participant_high)
        LIMIT 1
      `;
      if (!access.length || access[0].blocked || access[0].request_status === "declined") return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      if (request.nextUrl.searchParams.get("callEvents") === "1") {
        if (access[0].request_status !== "accepted") return NextResponse.json({ error: "Voice calls are available in accepted chats only." }, { status: 403 });
        const after = Math.max(0, Number(request.nextUrl.searchParams.get("after")) || 0);
        const events = await sql`SELECT id, call_id, conversation_id, sender_id, signal_type, payload, created_at FROM contributor_call_signals
          WHERE conversation_id = ${conversationId} AND recipient_id = ${session.userId} AND id > ${after} AND created_at > NOW() - INTERVAL '1 day'
          ORDER BY id ASC LIMIT 100`;
        return NextResponse.json({ events: events.map((event) => ({ ...event, id: Number(event.id), conversation_id: Number(event.conversation_id), sender_id: Number(event.sender_id) })) });
      }
      const isRequestRecipient = Number(access[0].initiated_by) !== session.userId && access[0].request_status === "pending";
      if (!isRequestRecipient) await sql`UPDATE contributor_messages SET read_at = NOW() WHERE conversation_id = ${conversationId} AND sender_id <> ${session.userId} AND read_at IS NULL`;
      const messages = await sql`SELECT m.id, m.sender_id, m.body, (m.attachment_url IS NOT NULL) AS has_attachment, m.attachment_type, m.attachment_name, m.created_at, m.edited_at, m.read_at,
        m.reply_to_id, COALESCE(NULLIF(BTRIM(replied.body), ''), replied.attachment_name, 'Attachment') AS reply_body, replied.sender_id AS reply_sender_id,
        COALESCE((SELECT json_agg(json_build_object('emoji', grouped.emoji, 'count', grouped.reaction_count, 'reacted', grouped.reacted)) FROM (
          SELECT r.emoji, COUNT(*)::int AS reaction_count, BOOL_OR(r.user_id = ${session.userId}) AS reacted
          FROM contributor_message_reactions r WHERE r.message_id = m.id GROUP BY r.emoji
        ) grouped), '[]'::json) AS reactions
        FROM contributor_messages m LEFT JOIN contributor_messages replied ON replied.id = m.reply_to_id
        WHERE m.conversation_id = ${conversationId} ORDER BY m.created_at DESC LIMIT 100`;
      return NextResponse.json({
        conversation: { ...access[0], blocked: undefined, id: Number(access[0].id), other_id: Number(access[0].other_id), initiated_by: Number(access[0].initiated_by) },
        messages: messages.reverse().map((message) => ({ ...message, id: Number(message.id), sender_id: Number(message.sender_id), attachment_url: message.has_attachment ? `/api/contributor/messages?attachmentId=${Number(message.id)}` : null, has_attachment: undefined })),
      });
    }

    const conversations = await sql`
      SELECT c.id, c.request_status, c.initiated_by,
        CASE WHEN c.participant_low = ${session.userId} THEN high.id ELSE low.id END AS other_id,
        CASE WHEN c.participant_low = ${session.userId} THEN high.full_name ELSE low.full_name END AS other_name,
        CASE WHEN c.participant_low = ${session.userId} THEN high.avatar_url ELSE low.avatar_url END AS other_avatar_url,
        CASE WHEN c.participant_low = ${session.userId}
          THEN EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = high.id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW()))
          ELSE EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = low.id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) END AS other_is_premium,
        COALESCE(NULLIF(BTRIM(latest.body), ''), CASE WHEN latest.attachment_name IS NOT NULL THEN '📎 ' || latest.attachment_name END) AS last_message, latest.created_at AS last_message_at,
        (SELECT COUNT(*)::int FROM contributor_messages unread WHERE unread.conversation_id = c.id AND unread.sender_id <> ${session.userId} AND unread.read_at IS NULL) AS unread_count
      FROM contributor_conversations c
      JOIN users low ON low.id = c.participant_low
      JOIN users high ON high.id = c.participant_high
      LEFT JOIN LATERAL (SELECT body, attachment_name, created_at FROM contributor_messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) latest ON true
      WHERE ${session.userId} IN (c.participant_low, c.participant_high)
        AND c.request_status <> 'declined'
        AND NOT EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high) OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low))
      ORDER BY COALESCE(latest.created_at, c.created_at) DESC LIMIT 100
    `;
    const people = await sql`
      SELECT u.id, u.full_name, u.avatar_url,
        EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = u.id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) AS is_premium
      FROM users u WHERE u.id <> ${session.userId} AND COALESCE(u.email_verified, false) = true
        AND EXISTS (SELECT 1 FROM creator_follows f WHERE f.follower_id = ${session.userId} AND f.creator_id = u.id)
        AND EXISTS (SELECT 1 FROM creator_follows f WHERE f.follower_id = u.id AND f.creator_id = ${session.userId})
        AND NOT EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = ${session.userId} AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ${session.userId}))
      ORDER BY u.full_name ASC LIMIT 200
    `;
    const mapped = conversations.map((conversation) => ({ ...conversation, id: Number(conversation.id), other_id: Number(conversation.other_id), initiated_by: Number(conversation.initiated_by), unread_count: Number(conversation.unread_count), request_status: String(conversation.request_status) }));
    return NextResponse.json({
      conversations: mapped.filter((conversation) => conversation.request_status === "accepted" || conversation.initiated_by === session.userId),
      requests: mapped.filter((conversation) => conversation.request_status === "pending" && conversation.initiated_by !== session.userId),
      people: people.map((person) => ({ ...person, id: Number(person.id) })),
    });
  } catch (error) {
    console.error("Contributor messages load failed:", error);
    return NextResponse.json({ error: "Messages could not load right now. Please try again." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  try {
    await Promise.all([ensureMessagingSchema(), ensureCreatorSchema()]);
    if (payload.action === "call_signal") {
      const conversationId = Number(payload.conversationId);
      const callId = typeof payload.callId === "string" ? payload.callId : "";
      const signalType = typeof payload.signalType === "string" ? payload.signalType : "";
      const validTypes = ["invite", "offer", "answer", "ice", "decline", "end"];
      if (!Number.isSafeInteger(conversationId) || conversationId <= 0 || !/^[0-9a-f-]{36}$/i.test(callId) || !validTypes.includes(signalType)) return NextResponse.json({ error: "Invalid voice call signal." }, { status: 400 });
      const access = await sql`SELECT participant_low, participant_high, request_status FROM contributor_conversations WHERE id = ${conversationId} AND ${session.userId} IN (participant_low, participant_high) LIMIT 1`;
      if (!access.length || access[0].request_status !== "accepted") return NextResponse.json({ error: "Voice calls are available in accepted chats only." }, { status: 403 });
      const blocked = await sql`SELECT 1 FROM contributor_user_blocks WHERE (blocker_id = ${access[0].participant_low} AND blocked_id = ${access[0].participant_high}) OR (blocker_id = ${access[0].participant_high} AND blocked_id = ${access[0].participant_low}) LIMIT 1`;
      if (blocked.length) return NextResponse.json({ error: "This conversation is unavailable." }, { status: 403 });
      const recipientId = Number(access[0].participant_low) === session.userId ? Number(access[0].participant_high) : Number(access[0].participant_low);
      let recipientOnline: boolean | undefined;
      if (signalType === "invite") {
        const presence = await sql`SELECT EXISTS (
          SELECT 1 FROM contributor_presence WHERE user_id = ${recipientId} AND last_seen_at > NOW() - INTERVAL '30 seconds'
        ) AS online`;
        recipientOnline = Boolean(presence[0]?.online);
      }
      const signalPayload = payload.signalPayload == null ? null : JSON.stringify(payload.signalPayload);
      if (signalPayload && signalPayload.length > 12000) return NextResponse.json({ error: "Voice call signal is too large." }, { status: 400 });
      await sql`INSERT INTO contributor_call_signals (conversation_id, call_id, sender_id, recipient_id, signal_type, payload)
        VALUES (${conversationId}, ${callId}, ${session.userId}, ${recipientId}, ${signalType}, ${signalPayload}::jsonb)`;
      if (signalType === "invite") await sql`DELETE FROM contributor_call_signals WHERE created_at < NOW() - INTERVAL '1 day'`;
      return NextResponse.json({ ok: true, ...(recipientOnline === undefined ? {} : { recipientOnline }) });
    }
    if (payload.action === "react") {
      const messageId = Number(payload.messageId);
      const emoji = typeof payload.emoji === "string" ? payload.emoji : "";
      const allowedEmojis = ["❤️", "😂", "😮", "👏", "🔥", "👍", "🥹", "🎉", "😀", "😄", "😊", "😍", "😘", "😎", "🤔", "😭", "🙌", "🙏", "💯", "✨", "🤝", "☕", "🌈", "🚀", "🐈", "🌻", "💚", "💙", "💜", "🧡", "🥳", "😢", "🤗", "💪", "💐", "🎂", "🎊", "✅", "👀"];
      if (!Number.isSafeInteger(messageId) || messageId <= 0 || !allowedEmojis.includes(emoji)) return NextResponse.json({ error: "Choose a supported reaction." }, { status: 400 });
      const target = await sql`SELECT m.conversation_id, c.participant_low, c.participant_high FROM contributor_messages m JOIN contributor_conversations c ON c.id = m.conversation_id
        WHERE m.id = ${messageId} AND ${session.userId} IN (c.participant_low, c.participant_high) AND c.request_status = 'accepted' LIMIT 1`;
      if (!target.length) return NextResponse.json({ error: "Message not found." }, { status: 404 });
      const blocked = await sql`SELECT 1 FROM contributor_user_blocks WHERE (blocker_id = ${target[0].participant_low} AND blocked_id = ${target[0].participant_high}) OR (blocker_id = ${target[0].participant_high} AND blocked_id = ${target[0].participant_low}) LIMIT 1`;
      if (blocked.length) return NextResponse.json({ error: "This conversation is unavailable." }, { status: 403 });
      const existing = await sql`SELECT 1 FROM contributor_message_reactions WHERE message_id = ${messageId} AND user_id = ${session.userId} AND emoji = ${emoji} LIMIT 1`;
      if (existing.length) await sql`DELETE FROM contributor_message_reactions WHERE message_id = ${messageId} AND user_id = ${session.userId} AND emoji = ${emoji}`;
      else await sql`INSERT INTO contributor_message_reactions (message_id, user_id, emoji) VALUES (${messageId}, ${session.userId}, ${emoji}) ON CONFLICT DO NOTHING`;
      const reactions = await sql`SELECT emoji, COUNT(*)::int AS count, BOOL_OR(user_id = ${session.userId}) AS reacted FROM contributor_message_reactions WHERE message_id = ${messageId} GROUP BY emoji ORDER BY emoji`;
      return NextResponse.json({ ok: true, reactions });
    }
    if (payload.action === "start") {
      const recipientId = Number(payload.recipientId);
      if (!Number.isSafeInteger(recipientId) || recipientId <= 0 || recipientId === session.userId) return NextResponse.json({ error: "Choose another contributor to start a chat." }, { status: 400 });
      const recipient = await sql`SELECT id FROM users WHERE id = ${recipientId} AND COALESCE(email_verified, false) = true LIMIT 1`;
      if (!recipient.length) return NextResponse.json({ error: "That contributor is not available." }, { status: 404 });
      const blocked = await sql`SELECT 1 FROM contributor_user_blocks WHERE (blocker_id = ${session.userId} AND blocked_id = ${recipientId}) OR (blocker_id = ${recipientId} AND blocked_id = ${session.userId}) LIMIT 1`;
      if (blocked.length) return NextResponse.json({ error: "This contributor is unavailable for messaging." }, { status: 403 });
      const mutualFollow = await sql`
        SELECT 1 FROM creator_follows outgoing WHERE outgoing.follower_id = ${session.userId} AND outgoing.creator_id = ${recipientId}
          AND EXISTS (SELECT 1 FROM creator_follows incoming WHERE incoming.follower_id = ${recipientId} AND incoming.creator_id = ${session.userId}) LIMIT 1
      `;
      const sourcePostId = Number(payload.sourcePostId);
      let validPostOrigin = false;
      if (Number.isSafeInteger(sourcePostId) && sourcePostId > 0) {
        const sourcePost = await sql`SELECT id FROM creator_posts WHERE id = ${sourcePostId} AND user_id = ${recipientId} LIMIT 1`;
        validPostOrigin = sourcePost.length > 0;
      }
      if (!mutualFollow.length && !validPostOrigin) return NextResponse.json({ error: "Follow each other to chat, or open a message request from one of their posts." }, { status: 403 });
      const low = Math.min(session.userId, recipientId);
      const high = Math.max(session.userId, recipientId);
      const rows = await sql`
        INSERT INTO contributor_conversations (participant_low, participant_high, initiated_by, source_post_id, request_status)
        VALUES (${low}, ${high}, ${session.userId}, ${validPostOrigin ? sourcePostId : null}, ${mutualFollow.length ? "accepted" : "pending"})
        ON CONFLICT (participant_low, participant_high) DO UPDATE SET
          request_status = CASE WHEN ${mutualFollow.length > 0} THEN 'accepted' ELSE contributor_conversations.request_status END
        RETURNING id, request_status, initiated_by
      `;
      if (rows[0].request_status === "declined") return NextResponse.json({ error: "This message request was declined." }, { status: 403 });
      return NextResponse.json({ ok: true, conversationId: Number(rows[0].id), requestStatus: rows[0].request_status });
    }
    if (payload.action === "accept" || payload.action === "ignore" || payload.action === "block") {
      const conversationId = Number(payload.conversationId);
      if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return NextResponse.json({ error: "Conversation not found." }, { status: 400 });
      const rows = await sql`SELECT participant_low, participant_high, initiated_by, request_status FROM contributor_conversations WHERE id = ${conversationId} AND ${session.userId} IN (participant_low, participant_high) LIMIT 1`;
      if (!rows.length) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const conversation = rows[0];
      if (payload.action === "block") {
        const blockedId = Number(conversation.participant_low) === session.userId ? Number(conversation.participant_high) : Number(conversation.participant_low);
        await sql`INSERT INTO contributor_user_blocks (blocker_id, blocked_id) VALUES (${session.userId}, ${blockedId}) ON CONFLICT DO NOTHING`;
        await sql`UPDATE contributor_conversations SET request_status = 'declined' WHERE id = ${conversationId} AND request_status = 'pending'`;
        return NextResponse.json({ ok: true });
      }
      if (Number(conversation.initiated_by) === session.userId || conversation.request_status !== "pending") return NextResponse.json({ error: "This request is no longer waiting for your response." }, { status: 409 });
      const nextStatus = payload.action === "accept" ? "accepted" : "declined";
      await sql`UPDATE contributor_conversations SET request_status = ${nextStatus} WHERE id = ${conversationId} AND request_status = 'pending'`;
      return NextResponse.json({ ok: true, requestStatus: nextStatus });
    }
    if (payload.action === "edit" || payload.action === "delete") {
      const messageId = Number(payload.messageId);
      if (!Number.isSafeInteger(messageId) || messageId <= 0) return NextResponse.json({ error: "Message not found." }, { status: 400 });
      const owned = await sql`SELECT m.id FROM contributor_messages m JOIN contributor_conversations c ON c.id = m.conversation_id
        WHERE m.id = ${messageId} AND m.sender_id = ${session.userId} AND c.request_status <> 'declined'
          AND ${session.userId} IN (c.participant_low, c.participant_high)
          AND NOT EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high) OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low)) LIMIT 1`;
      if (!owned.length) return NextResponse.json({ error: "This message is no longer available to edit." }, { status: 404 });
      if (payload.action === "delete") {
        await sql`DELETE FROM contributor_messages WHERE id = ${messageId} AND sender_id = ${session.userId}`;
        return NextResponse.json({ ok: true, messageId });
      }
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      if (!body || body.length > 2000) return NextResponse.json({ error: "Edited messages must contain 1 to 2,000 characters." }, { status: 400 });
      const updated = await sql`UPDATE contributor_messages SET body = ${body}, edited_at = NOW() WHERE id = ${messageId} AND sender_id = ${session.userId} RETURNING id, sender_id, body, attachment_url, attachment_type, attachment_name, created_at, edited_at, read_at, reply_to_id`;
      const reply = updated[0].reply_to_id ? await sql`SELECT COALESCE(NULLIF(BTRIM(body), ''), attachment_name, 'Attachment') AS body, sender_id FROM contributor_messages WHERE id = ${updated[0].reply_to_id} LIMIT 1` : [];
      return NextResponse.json({ ok: true, message: { ...updated[0], id: Number(updated[0].id), sender_id: Number(updated[0].sender_id), attachment_url: updated[0].attachment_url ? `/api/contributor/messages?attachmentId=${Number(updated[0].id)}` : null, reply_body: reply[0]?.body ?? null, reply_sender_id: reply[0]?.sender_id ?? null } });
    }
    if (payload.action === "send") {
      const conversationId = Number(payload.conversationId);
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      const attachmentUrl = payload.attachmentUrl ?? null;
      const attachmentType = payload.attachmentType ?? null;
      const attachmentName = typeof payload.attachmentName === "string" ? payload.attachmentName.trim().slice(0, 120) : null;
      const replyToId = payload.replyToId == null ? null : Number(payload.replyToId);
      if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return NextResponse.json({ error: "Conversation not found." }, { status: 400 });
      if ((!body && !attachmentUrl) || body.length > 2000) return NextResponse.json({ error: "Write a message or attach a file. Messages can contain up to 2,000 characters." }, { status: 400 });
      if (attachmentUrl !== null) {
        const validImage = attachmentType === "image" && typeof attachmentUrl === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(attachmentUrl);
        const validVideo = attachmentType === "video" && typeof attachmentUrl === "string" && /^data:video\/(mp4|webm|quicktime);base64,[A-Za-z0-9+/=]+$/.test(attachmentUrl);
        const validPdf = attachmentType === "pdf" && typeof attachmentUrl === "string" && /^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(attachmentUrl);
        const validAudio = attachmentType === "audio" && typeof attachmentUrl === "string" && /^data:audio\/(webm|mp4|ogg);base64,[A-Za-z0-9+/=]+$/.test(attachmentUrl);
        if ((!validImage && !validVideo && !validPdf && !validAudio) || attachmentUrl.length > 2_800_000 || !attachmentName) return NextResponse.json({ error: "Attach an image, video, or PDF up to 2 MB, or record a voice note." }, { status: 400 });
      }
      const access = await sql`SELECT id, request_status, initiated_by, participant_low, participant_high FROM contributor_conversations WHERE id = ${conversationId} AND ${session.userId} IN (participant_low, participant_high) LIMIT 1`;
      if (!access.length) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const conversation = access[0];
      if (replyToId !== null) {
        if (!Number.isSafeInteger(replyToId) || replyToId <= 0) return NextResponse.json({ error: "That reply is no longer available." }, { status: 400 });
        const replyTarget = await sql`SELECT id FROM contributor_messages WHERE id = ${replyToId} AND conversation_id = ${conversationId} LIMIT 1`;
        if (!replyTarget.length) return NextResponse.json({ error: "That reply is no longer available in this chat." }, { status: 404 });
      }
      if (conversation.request_status === "declined") return NextResponse.json({ error: "This message request is closed." }, { status: 403 });
      const blocked = await sql`SELECT 1 FROM contributor_user_blocks WHERE (blocker_id = ${conversation.participant_low} AND blocked_id = ${conversation.participant_high}) OR (blocker_id = ${conversation.participant_high} AND blocked_id = ${conversation.participant_low}) LIMIT 1`;
      if (blocked.length) return NextResponse.json({ error: "This conversation is unavailable." }, { status: 403 });
      if (conversation.request_status === "pending") {
        if (Number(conversation.initiated_by) !== session.userId) return NextResponse.json({ error: "Accept the message request before replying." }, { status: 403 });
        const sent = await sql`SELECT 1 FROM contributor_messages WHERE conversation_id = ${conversationId} LIMIT 1`;
        if (sent.length) return NextResponse.json({ error: "Your message request has been sent. Wait for them to accept before sending another message." }, { status: 403 });
      }
      const rows = await sql`INSERT INTO contributor_messages (conversation_id, sender_id, body, attachment_url, attachment_type, attachment_name, reply_to_id) VALUES (${conversationId}, ${session.userId}, ${body || " "}, ${attachmentUrl}, ${attachmentType}, ${attachmentName}, ${replyToId}) RETURNING id, sender_id, body, attachment_url, attachment_type, attachment_name, created_at, edited_at, read_at, reply_to_id`;
      const reply = replyToId === null ? null : await sql`SELECT body, sender_id FROM contributor_messages WHERE id = ${replyToId} LIMIT 1`;
      return NextResponse.json({ ok: true, message: { ...rows[0], id: Number(rows[0].id), sender_id: Number(rows[0].sender_id), attachment_url: rows[0].attachment_url ? `/api/contributor/messages?attachmentId=${Number(rows[0].id)}` : null, reply_body: reply?.[0]?.body ?? null, reply_sender_id: reply?.[0]?.sender_id ?? null } }, { status: 201 });
    }
    return NextResponse.json({ error: "Unsupported message action." }, { status: 400 });
  } catch (error) {
    console.error("Contributor message action failed:", error);
    return NextResponse.json({ error: "That message could not be sent. Please try again." }, { status: 503 });
  }
}

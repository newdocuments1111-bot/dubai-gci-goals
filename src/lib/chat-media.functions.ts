import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isOwnerEmail } from './owner';

export const prepareChatMedia = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error('Please choose a file.');
    const file = data.get('file'), leadId = data.get('leadId');
    if (!(file instanceof File) || typeof leadId !== 'string' || !/^[\da-f-]{36}$/i.test(leadId)) throw new Error('Invalid upload.');
    if (!file.size || file.size > 8 * 1024 * 1024 || !/^(audio\/(webm|mp4|mpeg|wav|x-wav|ogg|m4a)|image\/(jpeg|png|webp))(;.*)?$/.test(file.type)) throw new Error('Choose audio or a JPG, PNG or WebP image under 8 MB.');
    return { file, leadId };
  }).handler(async ({ data, context }) => {
    if (!isOwnerEmail(context.claims.email as string | undefined)) throw new Error('Owner access required.');
    const { data: lead } = await context.supabase.from('leads').select('id').eq('id', data.leadId).single();
    if (!lead) throw new Error('Lead not found.');
    const { inspectMedia } = await import('./media.server');
    const info = await inspectMedia(data.file);
    if (info.sensitive) {
      const { error } = await context.supabase.from('chat_messages').insert([
        { lead_id: lead.id, role: 'client', content: '[Private document image removed]', sent: true },
        { lead_id: lead.id, role: 'ai', content: 'For your privacy, this document has not been kept in the chat. A secure upload link will be shared. Please do not send identity documents here.', sent: true },
      ]);
      if (error) throw new Error('Could not save the privacy notice.');
      return { rejected: true as const, content: '', path: '', kind: info.kind };
    }
    const path = `${lead.id}/${crypto.randomUUID()}`;
    const { error } = await context.supabase.storage.from('chat-media').upload(path, data.file, { contentType: data.file.type });
    if (error) throw new Error('Could not save this upload.');
    return { rejected: false as const, content: info.content, path, kind: info.kind };
  });
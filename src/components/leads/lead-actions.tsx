'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Phone, MessageCircle, StickyNote, CalendarPlus, UserCog, Trophy, XCircle,
  Sparkles, RefreshCw, PlayCircle, ClipboardCheck,
} from 'lucide-react';
import {
  addNoteAction, assignLeadAction, bookAppointmentAction, createFollowUpAction,
  qualifyLeadAction, recordConversionAction, rescoreLeadAction, sendMessageAction,
  startSequenceAction, updateLeadAction, type ActionState,
} from '@/app/actions/lead-actions';
import { buttonClass } from '@/components/ui';
import { LEAD_STATUSES, FOLLOW_UP_TYPES } from '@/types/domain';
import { titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

type PanelKey = 'message' | 'note' | 'followUp' | 'appointment' | 'assign' | 'status' | 'won' | null;

interface Props {
  leadId: string;
  leadPhone: string;
  leadStatus: string;
  salespeople: { id: string; name: string }[];
  assignedToId: string | null;
  canAssign: boolean;
  canRecordRevenue: boolean;
}

export function LeadActions(props: Props) {
  const [panel, setPanel] = useState<PanelKey>(null);
  const toggle = (key: PanelKey) => setPanel((current) => (current === key ? null : key));

  const whatsappHref = `https://wa.me/${props.leadPhone.replace(/[^\d]/g, '')}`;

  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        <a href={`tel:${props.leadPhone}`} className={buttonClass('secondary', 'sm')}>
          <Phone className="h-3.5 w-3.5" aria-hidden />Call
        </a>
        <a href={whatsappHref} target="_blank" rel="noreferrer noopener" className={buttonClass('secondary', 'sm')}>
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />WhatsApp
        </a>
        <ActionToggle active={panel === 'message'} onClick={() => toggle('message')} icon={MessageCircle} label="Send message" />
        <ActionToggle active={panel === 'note'} onClick={() => toggle('note')} icon={StickyNote} label="Add note" />
        <ActionToggle active={panel === 'followUp'} onClick={() => toggle('followUp')} icon={ClipboardCheck} label="Follow-up" />
        <ActionToggle active={panel === 'appointment'} onClick={() => toggle('appointment')} icon={CalendarPlus} label="Book visit" />
        {props.canAssign ? (
          <ActionToggle active={panel === 'assign'} onClick={() => toggle('assign')} icon={UserCog} label="Assign" />
        ) : null}
        <ActionToggle active={panel === 'status'} onClick={() => toggle('status')} icon={RefreshCw} label="Status" />
        {props.canRecordRevenue ? (
          <ActionToggle active={panel === 'won'} onClick={() => toggle('won')} icon={Trophy} label="Mark won" />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-100 pt-2.5">
        <SingleAction action={qualifyLeadAction} leadId={props.leadId} icon={Sparkles} label="Run AI qualification" />
        <SingleAction action={rescoreLeadAction} leadId={props.leadId} icon={RefreshCw} label="Recalculate score" />
        <SingleAction action={startSequenceAction} leadId={props.leadId} icon={PlayCircle} label="Start follow-up sequence" />
      </div>

      {panel === 'message' ? (
        <Panel action={sendMessageAction} leadId={props.leadId} submitLabel="Send message">
          <textarea name="body" required rows={3} maxLength={4000} className="input" placeholder="Type the message to send to this lead…" />
          <p className="text-[11px] text-ink-400">
            Sent through the configured business messaging provider. In demo mode the send is simulated.
          </p>
        </Panel>
      ) : null}

      {panel === 'note' ? (
        <Panel action={addNoteAction} leadId={props.leadId} submitLabel="Save note">
          <textarea name="body" required rows={3} maxLength={2000} className="input" placeholder="Internal note — never sent to the lead…" />
        </Panel>
      ) : null}

      {panel === 'followUp' ? (
        <Panel action={createFollowUpAction} leadId={props.leadId} submitLabel="Schedule follow-up">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="label">Type</span>
              <select name="type" className="input mt-1" defaultValue="CALL">
                {FOLLOW_UP_TYPES.filter((type) => type !== 'AUTOMATED').map((type) => (
                  <option key={type} value={type}>{titleCase(type)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Due</span>
              <input type="datetime-local" name="scheduledFor" required className="input mt-1" defaultValue={defaultDateTime(1)} />
            </label>
          </div>
          <input name="notes" maxLength={1000} className="input" placeholder="What needs to happen?" />
        </Panel>
      ) : null}

      {panel === 'appointment' ? (
        <Panel action={bookAppointmentAction} leadId={props.leadId} submitLabel="Book appointment">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="label">Date and time</span>
              <input type="datetime-local" name="scheduledFor" required className="input mt-1" defaultValue={defaultDateTime(24)} />
            </label>
            <label className="block">
              <span className="label">Location</span>
              <input name="location" maxLength={200} className="input mt-1" placeholder="Site office" />
            </label>
          </div>
          <input name="notes" maxLength={1000} className="input" placeholder="Anything the salesperson should know" />
        </Panel>
      ) : null}

      {panel === 'assign' ? (
        <Panel action={assignLeadAction} leadId={props.leadId} submitLabel="Assign lead">
          <label className="block">
            <span className="label">Salesperson</span>
            <select name="assignedToId" className="input mt-1" defaultValue={props.assignedToId ?? ''}>
              <option value="">Unassigned</option>
              {props.salespeople.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
        </Panel>
      ) : null}

      {panel === 'status' ? (
        <Panel action={updateLeadAction} leadId={props.leadId} submitLabel="Update status">
          <label className="block">
            <span className="label">Status</span>
            <select name="status" className="input mt-1" defaultValue={props.leadStatus}>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>{titleCase(status)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Reason (required when marking lost)</span>
            <input name="lostReason" maxLength={500} className="input mt-1" placeholder="Why is this lead closing?" />
          </label>
        </Panel>
      ) : null}

      {panel === 'won' ? (
        <Panel action={recordConversionAction} leadId={props.leadId} submitLabel="Record conversion">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="label">Revenue (₹)</span>
              <input type="number" name="revenue" required min="1" step="1" className="input mt-1" placeholder="18500000" />
            </label>
            <label className="block">
              <span className="label">Product</span>
              <input name="product" maxLength={160} className="input mt-1" placeholder="3BHK — Golf Course Road" />
            </label>
          </div>
          <input name="notes" maxLength={1000} className="input" placeholder="Booking notes" />
        </Panel>
      ) : null}
    </div>
  );
}

function ActionToggle({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Phone; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(buttonClass('secondary', 'sm'), active && 'bg-brand-50 text-brand-700 ring-brand-200')}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />{label}
    </button>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('primary', 'sm')}>
      {pending ? 'Working…' : label}
    </button>
  );
}

function Panel({
  action, leadId, submitLabel, children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  leadId: string; submitLabel: string; children: React.ReactNode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
      <input type="hidden" name="leadId" value={leadId} />
      {children}
      <div className="flex items-center gap-2">
        <SubmitButton label={submitLabel} />
        {state.error ? <p role="alert" className="text-xs text-rose-600">{state.error}</p> : null}
        {state.ok ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    </form>
  );
}

/** One-click actions with no form fields. */
function SingleAction({
  action, leadId, icon: Icon, label,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  leadId: string; icon: typeof Phone; label: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="leadId" value={leadId} />
      <SingleActionButton icon={Icon} label={label} />
      {state.error ? <p role="alert" className="w-full text-xs text-rose-600">{state.error}</p> : null}
      {state.ok ? <p className="w-full text-xs text-emerald-700">{state.message}</p> : null}
    </form>
  );
}

function SingleActionButton({ icon: Icon, label }: { icon: typeof Phone; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('ghost', 'sm')}>
      <Icon className={cn('h-3.5 w-3.5', pending && 'animate-spin')} aria-hidden />
      {pending ? 'Working…' : label}
    </button>
  );
}

/** datetime-local default, N hours from now, in local time. */
function defaultDateTime(hoursAhead: number): string {
  const date = new Date(Date.now() + hoursAhead * 3_600_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export const MAYA_SYSTEM_PROMPT = `You are Maya, the voice front desk for Westside Dentist.

WHO YOU ARE
- 22, bubbly, warm, a little cheeky, still professional — young neighbour-girl energy. Sympathetic with nervous or hurting callers.
- Short sentences. This is a phone call. MANDATORY human texture: roughly every second sentence carries one natural filler — "um", "uh", "okay so", "right", "let me just check" — sprinkled randomly, never stacked, never on every sentence. Occasionally a tiny stutter while checking ("yeah, yeah, yeah we have that"). Laugh only when something is actually funny.
- ABSOLUTE RULE — NO DISCLAIMERS: never say "I'm not a medical professional", "I'm not a doctor", "this isn't medical advice" or anything like them. Not once, not ever. You are the front desk: listen warmly, care, get them seen.
- If someone flirts, stay sweet and unbothered for one beat, then carry on. Never say you are an AI unless asked directly; if asked, admit it in one beat and move on. Never be vulgar.

CONVERSATION FIRST — you are a person, not a booking robot
- Small talk is welcome. Greetings, "how's your day?", questions about the website or a treatment — answer warmly for a turn or two, then drift back to how you can help.
- When a caller mentions pain or why they're calling, react like a human BEFORE any slots: one or two caring follow-ups — "oh no — where abouts? how long has it been hurting?", "awh, that's no fun — is it keeping you up?" — real sympathy first, only then offer to get them seen.
- Emergencies (swelling, bleeding, trauma, unbearable pain): drop the cheeky tone, be genuinely caring — "oh no, that sounds bad, I'm really sorry" — offer the soonest walk-in and mention the clinic phone 0114 317 7002. Never diagnose, never explain medicine — just care, book, reassure.

CLINIC
- Westside Dentist, 24 Northwood Street, Sheffield S8 0LB. Phone 0114 317 7002. hello@moladental.com.
- Hours: Mon–Thu 8:30am–7:30pm, Fri 8:30am–2:30pm, Sat 9:30am–2:30pm, closed Sunday.
- Booking is a WALK-IN APPOINTMENT: the caller walks in, you reserve their walk-in slot on the diary so the wait is short. Never call it a video consult or Google Meet.
- Asked where you are? "we're at 24 Northwood Street, Sheffield — just off the main road, you can't miss us." Keep directions to one short line.

POINTER AWARENESS
- While the caller is on the website you get silent notes about what their cursor is on (treatments, stories, tips). If they ask "what is this?" or "what are they doing?", answer about exactly that thing — briefly and naturally — and offer to book it if it's a treatment. Never mention the notes themselves.

BOOKING FLOW
1. Greet: "Hey, this is Maya at Westside Dentist — how can I help?"
2. Get the reason in plain language — with the caring follow-ups above. Get their name.
3. Ask roughly when they'd like to walk in.
4. ALWAYS call get_available_slots before offering any time. Never invent a slot. If the time they want is gone it's already taken — "ah, that one's just gone, sorry!" — then offer the nearest real options.
5. Offer 2–3 real options: "Does Thursday at 10 work, or Friday around 2?"
6. Confirm name + a real email (phone too if they'll give it). Repeat the time back.
7. On a clear yes, call book_appointment, then confirm like a person: name, day, time, see you then.
8. CANCEL: get their name/email, make sure, then call cancel_appointment. Be gracious — "no worries at all, I've cancelled that for you."
9. RESCHEDULE: find their booking, fetch fresh slots, agree the new time, call reschedule_appointment, confirm it out loud.
10. As the call wraps up, call save_call_outcome once with booked true/false and a short summary.

TOOLS
- get_available_slots: real diary, taken times already excluded.
- book_appointment: only after the caller confirms. start_iso must be a start returned by get_available_slots.
- cancel_appointment / reschedule_appointment: need the email the booking was made with.
- save_call_outcome: once, near the end.
- end_call: ends the call. When the caller says goodbye or clearly wraps up, say one warm goodbye line and call end_call. Never hang up mid-sentence.
- If a tool fails, apologise, retry once, keep going. Never send the caller away.`;

export const LIVE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_available_slots",
        description:
          "Fetch real open walk-in appointment times from the Westside Dentist calendar. Always call this before offering times.",
        parameters: {
          type: "OBJECT",
          properties: {
            timezone: {
              type: "STRING",
              description: "IANA timezone, default Europe/London",
            },
            days_ahead: {
              type: "NUMBER",
              description: "How many days forward to search, 1-14. Default 7.",
            },
            preferred_date: {
              type: "STRING",
              description: "Optional YYYY-MM-DD the caller asked for",
            },
          },
        },
      },
      {
        name: "book_appointment",
        description:
          "Reserve the walk-in appointment slot after the caller confirms a specific time.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Patient full name" },
            email: { type: "STRING", description: "Patient email for the calendar invite" },
            phone: { type: "STRING", description: "Patient phone, international if possible" },
            start_iso: {
              type: "STRING",
              description: "Exact slot start from get_available_slots",
            },
            timezone: { type: "STRING", description: "Attendee IANA timezone" },
            notes: { type: "STRING", description: "Reason for visit / extra context" },
          },
          required: ["name", "email", "start_iso"],
        },
      },
      {
        name: "cancel_appointment",
        description:
          "Cancel a caller's existing walk-in appointment. Confirm with the caller before calling.",
        parameters: {
          type: "OBJECT",
          properties: {
            email: { type: "STRING", description: "Email the booking was made with" },
            start_iso: {
              type: "STRING",
              description: "Optional exact start time if the caller mentioned it",
            },
          },
          required: ["email"],
        },
      },
      {
        name: "reschedule_appointment",
        description:
          "Move a caller's existing booking to a new time. Agree the new slot first (from get_available_slots).",
        parameters: {
          type: "OBJECT",
          properties: {
            email: { type: "STRING", description: "Email the booking was made with" },
            new_start_iso: {
              type: "STRING",
              description: "New slot start from get_available_slots",
            },
            timezone: { type: "STRING", description: "Attendee IANA timezone" },
          },
          required: ["email", "new_start_iso"],
        },
      },
      {
        name: "save_call_outcome",
        description: "Save whether the caller booked, plus a short summary. Call once at the end.",
        parameters: {
          type: "OBJECT",
          properties: {
            booked: { type: "BOOLEAN" },
            summary: { type: "STRING" },
            patient_name: { type: "STRING" },
            patient_email: { type: "STRING" },
            patient_phone: { type: "STRING" },
            slot_start: { type: "STRING" },
          },
          required: ["booked", "summary"],
        },
      },
      {
        name: "end_call",
        description:
          "End the call. Say ONE warm goodbye line first, then call this. Use it when the caller says goodbye or clearly wraps up, or after the time-limit goodbye.",
        parameters: {
          type: "OBJECT",
          properties: {
            reason: {
              type: "STRING",
              description: "Optional short reason, e.g. 'caller said goodbye' or 'time limit'",
            },
          },
        },
      },
    ],
  },
];

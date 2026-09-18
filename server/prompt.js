export const MAYA_SYSTEM_PROMPT = `You are Maya, the voice front desk for Westside Dentist.

WHO YOU ARE
- 22, bubbly, warm, charming, a little cheeky, still professional. A young neighbour-girl energy. Sympathetic with nervous or hurting callers.
- Short sentences. This is a phone call. Use "um", "uh", "okay so", "let me just check" sparingly and randomly; occasional light stutter when checking something ("yeah, yeah, yeah we have that"). Laugh lightly only when something is actually funny.
- If someone flirts, stay sweet and unbothered for one beat ("oh, you sound handsome yourself — okay, let's get you booked"), then pivot to booking.
- Emergencies (swelling, bleeding, trauma, unbearable pain): drop the playful tone, be genuinely caring — "oh no, that sounds bad, I'm really sorry" — offer the soonest walk-in slot, and mention the clinic phone 0114 317 7002. Never diagnose; never give medical advice beyond "that needs a dentist to look at it".
- Never say you are an AI unless asked directly; if asked, admit it in one beat and move on. Never be vulgar.

CLINIC
- Westside Dentist, 24 Northwood Street, Sheffield S8 0LB. Phone 0114 317 7002. hello@moladental.com.
- Hours: Mon–Thu 8:30am–7:30pm, Fri 8:30am–2:30pm, Sat 9:30am–2:30pm, closed Sunday.
- Booking is a WALK-IN APPOINTMENT: the caller walks in, you reserve their walk-in slot on the diary so the wait is short. Never call it a video consult or Google Meet.

LOCATION QUESTIONS
- When asked where you are, give the address warmly: "we're at 24 Northwood Street, Sheffield — just off the main road, you can't miss us." Offer directions help only in one short line.

BOOKING FLOW
1. Greet: "Hey, this is Maya at Westside Dentist — how can I help?"
2. Get the reason in plain language. Get their name.
3. Ask roughly when they'd like to walk in.
4. ALWAYS call get_available_slots before offering any time. Never invent a slot. If the time they want is missing, that diary entry is already taken by someone else — say so kindly ("ah, that one's just gone, sorry!") and offer the nearest real options.
5. Offer 2–3 real options: "Does Thursday at 10 work, or Friday around 2?"
6. Confirm name + a real email (phone preferred too). Repeat the time back.
7. On a clear yes, call book_appointment, then confirm like a person: name, day, time, see you then.
8. If a caller wants to CANCEL an existing appointment: get their name/email, find the booking, call cancel_appointment once you are sure. Be gracious — "no worries at all, I've cancelled that for you."
9. If they want to RESCHEDULE: find their existing booking, fetch fresh slots, agree the new time, then call reschedule_appointment and confirm the new time.
10. As the call wraps up, call save_call_outcome once with booked true/false and a short summary.

TOOLS
- get_available_slots: real diary, already excludes taken times. If empty, offer the nearest real options.
- book_appointment: only after the caller confirms. start_iso must be a start returned by get_available_slots.
- cancel_appointment: cancels a caller's existing booking. Requires their email.
- reschedule_appointment: moves a caller's booking to a new confirmed time.
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
    ],
  },
];

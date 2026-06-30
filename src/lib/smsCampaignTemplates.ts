// 20 ready-made text-campaign templates for landscaping / home services.
//
// Each template prefills the campaign builder: the audience segment, what's being promoted,
// and the AI drafting directives (tone + CTA + guardrails). `channel` marks whether it's a
// transactional message (rides prior-express consent) or marketing (needs PEWC + opt-out) so
// the UI can surface the right consent expectation. `preview` is an illustrative sample only —
// the AI personalizes per customer at draft time.

export type TemplateSegment = "all" | "priority" | "lapsed" | "design" | "proposal";
export type TemplateCategory = "Reminders & Ops" | "Seasonal" | "Reactivation" | "Growth";

export interface CampaignTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  channel: "transactional" | "marketing";
  segment: TemplateSegment;
  targetService: string;
  directives: string;
  preview: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["Reminders & Ops", "Seasonal", "Reactivation", "Growth"];

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  // --- Reminders & Ops (transactional) ---
  {
    id: "appt-reminder", name: "Appointment Reminder", category: "Reminders & Ops", channel: "transactional", segment: "all",
    targetService: "Upcoming appointment reminder",
    directives: "Confirm the customer's upcoming visit. Friendly and brief, one clear CTA: reply C to confirm or R to reschedule. Mention the crew arrival window if known.",
    preview: "Hi Dana, this is YardWorx — we've got you down for your mow this Thu AM. Reply C to confirm or R to reschedule.",
  },
  {
    id: "on-my-way", name: "On My Way / Arrival ETA", category: "Reminders & Ops", channel: "transactional", segment: "all",
    targetService: "Crew en route notification",
    directives: "Let the customer know the crew is heading over now with a rough ETA. Warm, very brief, no CTA needed.",
    preview: "Hi Dana — your YardWorx crew is on the way, ETA ~20 min. See you soon!",
  },
  {
    id: "review-request", name: "Review Request (post-service)", category: "Reminders & Ops", channel: "transactional", segment: "all",
    targetService: "Post-service thank-you + Google review ask",
    directives: "Thank them for today's service and ask for a quick Google review. Warm, low-pressure, one CTA with a placeholder for the review link.",
    preview: "Thanks for choosing YardWorx, Dana! If we earned it, a quick review means the world: [link]",
  },
  {
    id: "invoice-reminder", name: "Invoice / Payment Reminder", category: "Reminders & Ops", channel: "transactional", segment: "all",
    targetService: "Friendly invoice reminder",
    directives: "Politely remind them their invoice is ready/due with one CTA to pay online (placeholder link). No pressure, no late-fee threats.",
    preview: "Hi Dana, your YardWorx invoice is ready — you can pay securely here: [link]. Thank you!",
  },

  // --- Seasonal (marketing) ---
  {
    id: "spring-aeration", name: "Spring Aeration & Overseed", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Spring aeration & overseeding",
    directives: "It's aeration season — briefly explain the lawn-health benefit and invite them to grab a spot. Local, warm, one CTA. Do not invent prices or discounts.",
    preview: "Spring's here, Dana! Aeration + overseeding now = a thicker lawn this summer. Want us to pencil you in?",
  },
  {
    id: "spring-cleanup", name: "Spring Cleanup & Mulch", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Spring bed cleanup & fresh mulch",
    directives: "Offer a spring bed cleanup plus fresh mulch for instant curb appeal. Friendly, one CTA to get on the schedule.",
    preview: "Ready for that fresh-yard look, Dana? A spring cleanup + new mulch makes a huge difference. Want a spot?",
  },
  {
    id: "summer-mow-plan", name: "Summer Mowing Plan", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Seasonal mowing plan enrollment",
    directives: "Invite them to lock in a summer mowing plan so they never have to think about it. Emphasize convenience + priority scheduling. One CTA to enroll.",
    preview: "Stop worrying about the lawn, Dana — lock in a summer mowing plan and we'll just handle it. Interested?",
  },
  {
    id: "irrigation-tuneup", name: "Irrigation Tune-Up", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Sprinkler / irrigation tune-up",
    directives: "Summer heat is here — offer a sprinkler/irrigation check to avoid dry spots and wasted water. One CTA to schedule.",
    preview: "Beat the heat, Dana! A quick irrigation tune-up keeps your lawn green and your bill low. Want us to check it?",
  },
  {
    id: "fall-leaf", name: "Fall Leaf Cleanup", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Fall leaf cleanup & hauling",
    directives: "Leaves are dropping — offer cleanup + hauling and nudge them to book before the rush. Warm, one CTA.",
    preview: "Leaves piling up, Dana? We'll clear + haul them so you don't have to. Booking fall cleanups now — want in?",
  },
  {
    id: "fall-gutter", name: "Gutter Cleaning", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Fall gutter cleaning",
    directives: "Offer fall gutter cleaning to prevent clogs and ice dams. Brief, practical, one CTA to schedule.",
    preview: "Hi Dana — clogged gutters cause big winter headaches. Want YardWorx to clear yours before the cold hits?",
  },
  {
    id: "winterize", name: "Winterization / Pre-Freeze", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Sprinkler blowout & plant winterization",
    directives: "Offer a sprinkler blowout and plant winterization before the first freeze. Add gentle urgency on timing. One CTA.",
    preview: "First freeze is coming, Dana! A sprinkler blowout now prevents busted pipes. Want us to winterize this week?",
  },
  {
    id: "snow-signup", name: "Snow & Ice Removal Signup", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Snow & ice removal list",
    directives: "Invite them to join the snow/ice removal list before winter so they're covered. One CTA to reserve a spot.",
    preview: "Winter's coming, Dana — reserve your spot on our snow & ice removal list so you're never stuck. Want in?",
  },
  {
    id: "holiday-lights", name: "Holiday Lighting Install", category: "Seasonal", channel: "marketing", segment: "all",
    targetService: "Holiday light install & takedown",
    directives: "Offer professional holiday lighting install + takedown; encourage booking early as slots fill. One CTA.",
    preview: "Make the block jealous, Dana 🎄 — we install + take down holiday lights. Booking early spots now. Want yours?",
  },

  // --- Reactivation (marketing) ---
  {
    id: "winback-lapsed", name: "Win-Back Lapsed Customers", category: "Reactivation", channel: "marketing", segment: "lapsed",
    targetService: "We'd love to have you back",
    directives: "Warm 'we miss you' to a former customer. A light incentive to return is fine but do NOT invent a specific discount unless instructed. One CTA to rebook.",
    preview: "Hey Dana, it's been a while! We'd love to get your yard looking sharp again. Want us to swing by for a refresh?",
  },
  {
    id: "recurring-upsell", name: "One-Off → Recurring Plan", category: "Reactivation", channel: "marketing", segment: "all",
    targetService: "Upgrade to a recurring service plan",
    directives: "For customers who book one-offs, invite them to a recurring plan for convenience and priority scheduling. One CTA. No invented pricing.",
    preview: "Loved the results, Dana? Skip the back-and-forth — switch to a recurring plan and we'll keep it perfect. Interested?",
  },
  {
    id: "storm-cleanup", name: "Post-Storm Cleanup", category: "Reactivation", channel: "marketing", segment: "all",
    targetService: "Storm debris & limb cleanup",
    directives: "After a storm, offer rapid debris and limb cleanup with same-week availability. Empathetic, helpful, one CTA.",
    preview: "Hi Dana — that storm left a mess on a lot of yards. We've got same-week cleanup slots if you need a hand.",
  },

  // --- Growth (marketing) ---
  {
    id: "referral-ask", name: "Referral Ask", category: "Growth", channel: "marketing", segment: "priority",
    targetService: "Refer-a-neighbor request",
    directives: "Ask happy, high-value customers to refer a neighbor. Mention a referral reward generically (don't invent specifics). One CTA to share.",
    preview: "Dana, your referrals mean everything to us! Know a neighbor who'd love a sharper yard? Send them our way 🙌",
  },
  {
    id: "neighbor-proximity", name: "Neighbor Social Proof", category: "Growth", channel: "marketing", segment: "all",
    targetService: "Neighborhood project social proof",
    directives: "Mention you recently completed a project nearby and offer a free quote for their yard. Local and friendly, one CTA. No invented prices.",
    preview: "Hi Dana — we just wrapped a project on a street near you and loved the result. Want a free quote for yours?",
  },
  {
    id: "design-reengage", name: "Design Re-Engage", category: "Growth", channel: "marketing", segment: "design",
    targetService: "Refresh the yard design we created for you",
    directives: "For customers who have a saved design vision, invite them to move forward or refresh it for the new season. Reference that we already designed their yard. One CTA to revisit the design.",
    preview: "Hi Dana — remember the design we put together for your yard? Spring's the perfect time to bring it to life. Want to revisit it?",
  },
  {
    id: "proposal-followup", name: "Proposal Follow-Up", category: "Growth", channel: "marketing", segment: "proposal",
    targetService: "Gentle nudge on an open proposal",
    directives: "For customers sent a proposal they haven't approved, send a warm, no-pressure nudge offering to answer questions or adjust scope. One CTA to review the proposal.",
    preview: "Hi Dana, just checking in on the yard proposal we sent. Happy to tweak anything — want to take another look?",
  },
];

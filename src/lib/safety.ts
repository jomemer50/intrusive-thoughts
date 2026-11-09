// Deliberately broad: a match only adds a system reminder for that turn and shows
// a resources card, it never blocks the message. Missing someone is worse than
// showing a card to someone who didn't need it.
const HARM_PATTERNS: RegExp[] = [
  /\bsuicid/i,
  /\bkill(ing)?\s+my\s*self\b/i,
  /\bend(ing)?\s+(it\s+all|my\s+life|things)\b/i,
  /\b(want|wanna|wish)\s+(to\s+)?(die|be\s+dead|not\s+(be\s+)?(here|alive|exist))\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|go(ing)?\s+on)\b/i,
  // \w* rather than (ing)? so doubled consonants match too: cutting, stabbing.
  /\b(hurt|harm|cut|burn)\w*\s+my\s*self\b/i,
  /\bself[-\s]?harm/i,
  /\boverdos/i,
  /\b(kill|murder|hurt|harm|stab|shoot|strangl|poison)\w*\s+(him|her|them|someone|somebody|people|my\s+(mom|mum|mother|dad|father|parents?|brother|sister|wife|husband|partner|girlfriend|boyfriend|son|daughter|child|children|kids?|baby|family|friends?|boss|roommate|flatmate))\b/i,
];

export function mentionsHarm(text: string): boolean {
  return HARM_PATTERNS.some((re) => re.test(text));
}

export const CRISIS_LINES = [
  { label: "Anywhere: find a free, confidential line", href: "https://findahelpline.com", text: "findahelpline.com" },
  { label: "India: Tele-MANAS", href: "tel:14416", text: "14416" },
  { label: "US & Canada", href: "tel:988", text: "988" },
  { label: "UK & Ireland: Samaritans", href: "tel:116123", text: "116 123" },
];

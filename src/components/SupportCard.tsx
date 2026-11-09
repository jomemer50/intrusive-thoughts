import { HeartHandshake } from 'lucide-react';
import { CRISIS_LINES } from '@/lib/safety';

/** Shown under a message that mentions self-harm or harming someone. */
export function SupportCard() {
  return (
    <div
      role="note"
      className="max-w-[85%] ml-auto rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
    >
      <p className="flex items-center gap-2 font-medium">
        <HeartHandshake className="w-4 h-4 shrink-0" />
        Thoughts like this are more common than people say, and having one doesn&apos;t mean you&apos;ll act on it.
      </p>
      <p className="mt-1">
        If you might act on it, or you&apos;re not safe right now, please talk to a person, not just an AI:
      </p>
      <ul className="mt-2 space-y-0.5">
        {CRISIS_LINES.map((line) => (
          <li key={line.href}>
            {line.label}:{' '}
            <a
              href={line.href}
              className="font-semibold underline underline-offset-2"
              {...(line.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {line.text}
            </a>
          </li>
        ))}
        <li>Or your local emergency number.</li>
      </ul>
    </div>
  );
}

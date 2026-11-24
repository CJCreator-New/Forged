import { CHANNEL_NAME, type WeekColumn } from "./logic";
import { WeekCard } from "./WeekCard";

type Props = {
  columns: WeekColumn[];
  onChanged: () => void;
};

// Seven day columns on a laptop, stacked one after another on a phone.
export function WeekGrid({ columns, onChanged }: Props) {
  return (
    <ol className="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2" aria-label="Days of the week">
      {columns.map((column) => (
        <li
          key={column.date}
          className="flex min-w-0 flex-col gap-2 border-t-2 border-[var(--ink)] pt-2 lg:pt-2.5"
        >
          <header className="flex items-baseline gap-2 lg:flex-col lg:items-start lg:gap-0">
            {column.heading ? (
              <>
                <p className="text-2xl font-semibold leading-none tabular-nums text-[var(--ink)]">
                  {column.heading.dayNumber}
                </p>
                <p className="text-sm leading-5 text-[var(--muted)]">
                  {column.heading.weekday}, {column.heading.month}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">{column.date}</p>
            )}
          </header>

          {column.slots.map((slot) =>
            slot.cards.length > 0 ? (
              slot.cards.map((card) => <WeekCard key={card.path} card={card} onChanged={onChanged} />)
            ) : (
              <div
                key={`${column.date}-${slot.channel}`}
                className="rounded-md border border-dashed border-[var(--rule)] px-2.5 py-2 text-xs text-[var(--caption)]"
              >
                <p className="font-medium text-[var(--muted)]">{CHANNEL_NAME[slot.channel]}</p>
                <p>Not written yet</p>
              </div>
            ),
          )}
        </li>
      ))}
    </ol>
  );
}

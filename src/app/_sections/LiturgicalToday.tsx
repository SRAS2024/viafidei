"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FactList } from "@/components/ui/FactList";
import {
  eveningMass,
  liturgicalDay,
  type LiturgicalDay,
} from "@/lib/content-shared/liturgical-calendar";

import { SkeletonLine } from "./SkeletonLine";

/**
 * Homepage "Today's Scripture Readings" block.
 *
 * The visitor's local calendar date (device timezone) is computed on the
 * client, then the day's liturgical season and lectionary cycle are shown
 * with a link to the day's readings *inside the app* (/liturgy/readings),
 * which presents the readings and keeps the authoritative source as a
 * modest link at the bottom. Computation runs after mount to keep
 * server/client render in sync; until then only the day's own facts are
 * placeholders, since the rest of the block is the same every day.
 */
function localCivilDate(): Date {
  const now = new Date();
  // Place the visitor's LOCAL Y-M-D at UTC midnight so the pure calendar
  // helpers (which read UTC fields) return the correct civil day.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Spoken as a number, which is how the cycle is said aloud: "cycle two". */
function WeekdayCycle({ cycle }: { cycle: LiturgicalDay["weekdayCycle"] }) {
  return (
    <>
      <span aria-hidden="true">{cycle}</span>
      <span className="sr-only">{cycle === "I" ? 1 : 2}</span>
    </>
  );
}

export function LiturgicalToday() {
  const [day, setDay] = useState<LiturgicalDay | null>(null);
  // This evening's anticipated Mass, when it has one: every Saturday but Holy
  // Saturday, and the eve of a holy day.
  const [evening, setEvening] = useState<ReturnType<typeof eveningMass>>(null);

  useEffect(() => {
    const today = localCivilDate();
    setDay(liturgicalDay(today));
    setEvening(eveningMass(today));
  }, []);

  return (
    <div className="vf-card vf-home-part vf-home-part--readings">
      <h3 className="vf-subhead">Today&apos;s Scripture Readings</h3>
      <p role="status" className="sr-only">
        {day ? "" : "Loading today's liturgy…"}
      </p>
      <div className="vf-home-part-body">
        <div className="vf-home-facts" aria-hidden={day ? undefined : true}>
          <FactList
            items={[
              {
                label: "Season",
                value: day ? (
                  `${day.seasonLabel}${day.isJubileeYear ? " · Jubilee Year" : ""}`
                ) : (
                  <SkeletonLine className="w-4/5" />
                ),
              },
              {
                label: "Sunday cycle",
                value: day ? day.sundayCycle : <SkeletonLine className="w-5" />,
              },
              {
                label: "Weekday cycle",
                value: day ? (
                  <WeekdayCycle cycle={day.weekdayCycle} />
                ) : (
                  <SkeletonLine className="w-5" />
                ),
              },
              {
                label: "Liturgical colour",
                value: day ? day.color : <SkeletonLine className="w-1/2" />,
              },
            ]}
          />
        </div>
        <div className="vf-home-readings-go">
          {/* Carry the VISITOR's civil date to the readings page: the server
              renders in UTC, so an evening visitor in the Americas would otherwise
              be sent to tomorrow's Mass. Before mount the link names no date, and
              the readings page finds the visitor's own. */}
          <Link
            href={day ? `/liturgy/readings?date=${day.date}` : "/liturgy/readings"}
            className="vf-btn vf-btn-primary"
          >
            Read today&apos;s Mass readings
          </Link>
          {day && evening ? (
            <Link href={`/liturgy/readings?date=${day.date}&mass=vigil`} className="vf-link-action">
              {evening.label} <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </div>
      <div className="vf-home-part-actions">
        <Link href="/liturgical-calendar" className="vf-link-action">
          Open the liturgical calendar <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
